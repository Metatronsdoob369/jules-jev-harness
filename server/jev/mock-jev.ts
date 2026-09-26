/**
 * A stand-in for Jev so the scaffold runs without a key.
 *
 * It speaks the real wire format (POST /v1/systemone -> { model, answers, usage }),
 * so everything above it (the SDK, the runner, the gates) runs for real.
 * Answers come from a small script keyed by question name.
 */
import type { Fetch } from "@typesafe-ai/sdk";

/** p = probability of yes (noul), of the picked label (choice), or of the level (score). */
export type Scripted = { p: number; pick?: string; level?: number };

/** Answers for the example gates. Anything unlisted gets a confident yes / first option. */
export const DEFAULT_SCRIPT: Record<string, Scripted> = {
  project: { pick: "harness", p: 0.9 },
  urgency: { level: 1, p: 0.8 },
  defined: { p: 0.93 },
  owner: { pick: "jules", p: 0.9 },
  size: { level: 1, p: 0.8 },
  clean_stop: { p: 0.95 },
  second_look: { p: 0.88 },
  helper: { pick: "reviewer", p: 0.86 },
  in_plan: { p: 0.96 },
  blast: { level: 1, p: 0.82 },
};

export interface MockOptions {
  script?: Record<string, Scripted>;
  /** Simulated response time. Real Jev answers in roughly 0.1-0.5 s. */
  latencyMs?: number;
  /** Respond with this HTTP status instead of answers (e.g. 401, 529). */
  status?: number;
  /** Collects every request body the mock receives (for tests). */
  calls?: unknown[];
}

type WireQuestion = { type: "noul" | "choice" | "score"; criteria?: unknown };
type WireRequest = { model?: string; state?: unknown; questions?: Record<string, WireQuestion> };

export function mockJev(options: MockOptions = {}): Fetch {
  const script = { ...DEFAULT_SCRIPT, ...options.script };

  return async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as WireRequest;
    options.calls?.push(body);
    await wait(options.latencyMs ?? 0, init?.signal ?? undefined);
    if (options.status) return json({ error: { message: `mock HTTP ${options.status}` } }, options.status);

    const answers: Record<string, unknown> = {};
    let chars = JSON.stringify(body.state ?? "").length;
    for (const [name, q] of Object.entries(body.questions ?? {})) {
      const s = script[name] ?? { p: 0.9 };
      chars += JSON.stringify(q).length;
      if (q.type === "noul") answers[name] = { type: "noul", noul: s.p };
      if (q.type === "choice") answers[name] = choiceAnswer(Object.keys(q.criteria as object), s);
      if (q.type === "score") answers[name] = scoreAnswer(q.criteria as unknown[], s);
    }
    return json({
      model: "jev-1.13.0 (mock)",
      answers,
      usage: { input_tokens: Math.round(chars / 4), output_tokens: 0 },
    });
  };
}

// The picked option gets p; the rest share what's left. Confidence follows
// TypeSafe's documented shape: (k * top - 1) / (k - 1) for k options.
function spread(k: number, top: number, p: number): number[] {
  return Array.from({ length: k }, (_, i) => (i === top ? p : (1 - p) / (k - 1)));
}
const confidenceOf = (probs: number[]) => (probs.length * Math.max(...probs) - 1) / (probs.length - 1);
const r3 = (x: number) => Math.round(x * 1000) / 1000;

function choiceAnswer(labels: string[], s: Scripted) {
  const top = Math.max(0, labels.indexOf(s.pick ?? labels[0] ?? ""));
  const probs = spread(labels.length, top, s.p);
  return {
    type: "choice",
    choice: labels[top],
    confidence: r3(confidenceOf(probs)),
    probabilities: Object.fromEntries(labels.map((label, i) => [label, r3(probs[i] ?? 0)])),
  };
}

function scoreAnswer(levels: unknown[], s: Scripted) {
  const probs = spread(levels.length, s.level ?? 0, s.p);
  return {
    type: "score",
    score: r3(probs.reduce((sum, p, i) => sum + p * i, 0)),
    confidence: r3(confidenceOf(probs)),
    legend: Object.fromEntries(levels.map((text, i) => [String(i), text])),
    probabilities: Object.fromEntries(probs.map((p, i) => [String(i), r3(p)])),
  };
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
