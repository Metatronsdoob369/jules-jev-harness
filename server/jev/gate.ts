/**
 * jev-gate: the universal block.
 *
 * Jev sits at GATES: fixed points in a workflow where software needs a snap
 * judgment. Every gate has the same six parts, so one runner handles them all:
 *
 *   1. rules     hard lines in plain code. Checked first; Jev can't override them.
 *   2. see       the only fields Jev is shown. Trimmed = faster, safer, sharper.
 *   3. ask       atomic questions, sent in one call, answered in parallel.
 *   4. decide    plain code turns the answers into one action + how sure it is.
 *   5. bands     that sureness x the action's stakes -> act / confirm / escalate.
 *   6. fallback  what happens if Jev is slow, down, or the state isn't safe to send.
 *
 * Code stays in control. Jev only ever answers questions.
 */
import {
  APIConnectionError,
  APIError,
  APITimeoutError,
  APIUserAbortError,
  AuthenticationError,
  RateLimitError,
  TypeSafeClient,
  TypeSafeError,
  type JsonValue,
  type Questions,
  type SystemOneResult,
  type TypeSafeClientConfig,
} from "@typesafe-ai/sdk";

// ── Outcomes and stakes ──────────────────────────────────────────────────────

/**
 * How a verdict gets carried out.
 *   act       do it now, automatically
 *   confirm   do it only after a yes (a person, or an approval card on the board)
 *   escalate  don't do it; a person decides, and `action` is only a suggestion
 */
export type Outcome = "act" | "confirm" | "escalate";

/** What it costs if an action turns out to be wrong. */
export type Stakes = "low" | "medium" | "high";

/** Sureness needed for each outcome. Anything under `confirm` escalates. */
export interface Band {
  act: number;
  confirm: number;
}

/**
 * Starting points, in the same range as TypeSafe's own routing examples.
 * Tune them per gate once you have real verdicts logged.
 */
export const DEFAULT_BANDS: Record<Stakes, Band> = {
  low: { act: 0.5, confirm: 0.3 },
  medium: { act: 0.7, confirm: 0.5 },
  high: { act: Number.POSITIVE_INFINITY, confirm: 0.6 }, // never runs unattended
};

// ── The gate shape ───────────────────────────────────────────────────────────

export type Details = { [key: string]: JsonValue };

/** What code proposes after reading Jev's answers. */
export interface Proposal<A extends string> {
  action: A;
  /** 0-1: how sure the answers behind this action were. */
  confidence: number;
  /** One short line a person can read on the tile. */
  why: string;
  /** Code may make a verdict more careful than its band. Never less. */
  atLeast?: Outcome;
  details?: Details;
}

/** A final call made by code alone (rules and fallbacks). */
export interface Ruling<A extends string> {
  action: A;
  outcome: Outcome;
  why: string;
  details?: Details;
}

export interface Gate<I, Q extends Questions, A extends string> {
  /** Short id, shown on the board and in logs. */
  name: string;
  /** Plain English: where this gate sits in the workflow. */
  where: string;
  /** Every action this gate can return, and the stakes if it's wrong. */
  actions: Record<A, Stakes>;
  /** 1. Hard lines. Return a ruling to stop here, or null to carry on. */
  rules?: (input: I) => Ruling<NoInfer<A>> | null;
  /** 2. The only fields Jev sees. Never secrets, never raw tool or web output. */
  see: (input: I) => Details;
  /** 3. One judgment per question. Point at state fields with `backticks`. */
  ask: Q | ((input: I) => Q);
  /** 4. Plain code: answers in, one action out. */
  decide: (answers: SystemOneResult<Q>["answers"], input: I) => Proposal<NoInfer<A>>;
  /** 5. Override the default bands for this gate. */
  bands?: Partial<Record<Stakes, Partial<Band>>>;
  /** 6. Used when Jev can't answer in time, or the state isn't safe to send. */
  fallback: Ruling<NoInfer<A>>;
  /** Time Jev gets before the fallback fires, in ms. Default 1200. */
  budgetMs?: number;
}

/** What every gate returns: the same shape everywhere, ready for a tile hover. */
export interface Verdict<A extends string = string> {
  gate: string;
  outcome: Outcome;
  action: A;
  /** 0-1. Rules report 1; fallbacks report 0 (Jev wasn't heard). */
  confidence: number;
  /** Who made the call. */
  source: "rule" | "jev" | "fallback";
  why: string;
  details?: Details;
  /** Wall-clock time for the whole gate. */
  ms: number;
  /** Input tokens Jev used. */
  tokens?: number;
  /** Exact model version that answered. */
  model?: string;
}

/** Wrap a gate definition to get full type checking on its answers and actions. */
export const defineGate = <I, const Q extends Questions, A extends string>(gate: Gate<I, Q, A>) => gate;

// ── The runner ───────────────────────────────────────────────────────────────

export interface RunnerOptions {
  /** Bring your own client, or pass config for a new one (reads TYPESAFE_API_KEY). */
  client?: TypeSafeClient;
  clientConfig?: TypeSafeClientConfig;
  /** Called with every verdict. Feed tile hovers, logs and the board from here. */
  onVerdict?: (verdict: Verdict) => void;
  /** Warn when a gate's state passes this size. Unrelated context lowers accuracy. */
  maxStateChars?: number;
}

export function createRunner(options: RunnerOptions = {}) {
  const client = options.client ?? new TypeSafeClient(options.clientConfig);
  const onVerdict = options.onVerdict ?? (() => {});
  const maxStateChars = options.maxStateChars ?? 8_000;

  async function run<I, Q extends Questions, A extends string>(gate: Gate<I, Q, A>, input: I): Promise<Verdict<A>> {
    const started = performance.now();
    const finish = (v: Omit<Verdict<A>, "gate" | "ms">): Verdict<A> => {
      const verdict: Verdict<A> = { gate: gate.name, ...v, ms: Math.round(performance.now() - started) };
      onVerdict(verdict);
      return verdict;
    };
    const fallBack = (reason: string) =>
      finish({ ...gate.fallback, why: `${gate.fallback.why} (${reason})`, confidence: 0, source: "fallback" });

    // 1. rules: code has the last word on hard lines, at zero latency
    const ruling = gate.rules?.(input);
    if (ruling) return finish({ ...ruling, confidence: 1, source: "rule" });

    // 2. see: build the trimmed state, and never ship a secret
    const state = gate.see(input);
    const text = JSON.stringify(state);
    if (looksLikeSecret(text)) return fallBack("state held a secret-looking value, so nothing was sent");
    if (text.length > maxStateChars) {
      client.logger.warn(`[gate ${gate.name}] state is ${text.length} chars; trim it, unrelated context lowers accuracy`);
    }

    // 3. ask: one call, every question answered in parallel, inside a hard time budget
    const budget = gate.budgetMs ?? 1_200;
    const questions = typeof gate.ask === "function" ? (gate.ask as (input: I) => Q)(input) : gate.ask;
    let result: SystemOneResult<Q>;
    try {
      result = await client.systemOne(
        { state, questions },
        { signal: AbortSignal.timeout(budget), timeout: budget, retry: { maxRetries: 1 } },
      );
    } catch (err) {
      const reason = explain(err, budget);
      client.logger.warn(`[gate ${gate.name}] fell back: ${reason}`);
      return fallBack(`Jev: ${reason}`);
    }

    // 4. decide: plain code turns the answers into one action
    const proposal = gate.decide(result.answers, input);

    // 5. bands: sureness x the action's stakes -> outcome. Code may only tighten it.
    const stakes: Stakes = gate.actions[proposal.action] ?? "high";
    const band = { ...DEFAULT_BANDS[stakes], ...gate.bands?.[stakes] };
    let outcome = outcomeFor(proposal.confidence, band);
    if (proposal.atLeast) outcome = mostCareful(outcome, proposal.atLeast);

    return finish({
      outcome,
      action: proposal.action,
      confidence: round(proposal.confidence),
      source: "jev",
      why: proposal.why,
      details: proposal.details,
      tokens: result.usage.input_tokens,
      model: result.model,
    });
  }

  return { run, client };
}

// ── Bands ────────────────────────────────────────────────────────────────────

const CAREFUL: readonly Outcome[] = ["act", "confirm", "escalate"];

/** Sureness against a band -> outcome. */
export function outcomeFor(confidence: number, band: Band): Outcome {
  if (confidence >= band.act) return "act";
  if (confidence >= band.confirm) return "confirm";
  return "escalate";
}

/** The more careful of two outcomes. */
export function mostCareful(a: Outcome, b: Outcome): Outcome {
  return CAREFUL.indexOf(a) >= CAREFUL.indexOf(b) ? a : b;
}

// ── Helpers for `decide` ─────────────────────────────────────────────────────

/**
 * Yes/no answers come back as a single probability. This turns one into 0-1
 * sureness: 0 at a coin flip, 1 at certain. Same idea as TypeSafe's Choice
 * confidence, applied to two options.
 */
export const sureness = (p: number): number => Math.abs(2 * p - 1);

/** A Score answer as a 0-1 position on its rubric (0 = first level, 1 = last). */
export const position = (answer: { score: number; legend: object }): number =>
  answer.score / Math.max(1, Object.keys(answer.legend).length - 1);

/** 0.8342 -> "83%" */
export const pct = (x: number): string => `${Math.round(x * 100)}%`;

const round = (x: number): number => Math.round(x * 100) / 100;

function explain(err: unknown, budget: number): string {
  if (err instanceof APIUserAbortError || err instanceof APITimeoutError) return `no answer within ${budget} ms`;
  if (err instanceof RateLimitError) return "rate limited";
  if (err instanceof AuthenticationError) return "API key missing or invalid";
  if (err instanceof APIError) return `HTTP ${err.status}`;
  if (err instanceof APIConnectionError) return "couldn't connect";
  if (err instanceof TypeSafeError) return err.message;
  return err instanceof Error ? err.message : String(err);
}

// ── Never ship a secret ──────────────────────────────────────────────────────

/** Common key and token shapes. Add your own providers here. */
const SECRET_SHAPES: readonly RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, // private keys
  /\bsk-[A-Za-z0-9_-]{20,}/, // OpenAI- and Anthropic-style keys
  /\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}/, // Stripe
  /\bgh[pousr]_[A-Za-z0-9]{36,}/, // GitHub tokens
  /\bgithub_pat_[A-Za-z0-9_]{22,}/, // GitHub fine-grained tokens
  /\bAIza[0-9A-Za-z_-]{35}/, // Google API keys
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access keys
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/, // Slack tokens
];

export const looksLikeSecret = (text: string): boolean => SECRET_SHAPES.some((shape) => shape.test(text));
