/**
 * The registry: your predetermined areas of impact.
 *
 * Five gates along a task's life on the board:
 *
 *   intake -> route -> window -> risky -> done
 *
 * Each one is the same six-part block (see gate.ts). To add an area of impact,
 * copy a gate and fill in the parts. The runner, bands, time budget, secret
 * check and logging come with it.
 */
import { choice, noul, score } from "@typesafe-ai/sdk";
import { defineGate, pct, position, sureness } from "./gate.js";
import { scoreSpectralDiff, type SpectralAuditReport } from "../spectral/fingerprint.js";

/** A tile on the board, as the gates see it. */
export interface Task {
  id: string;
  title: string;
  /** What the person typed or imported. Treat it as untrusted text. */
  brief: string;
  project?: string;
  /** GitHub repo. No repo, no dispatch: work has to land where you can see it. */
  repo?: string;
  /** Approved plan steps. Windows sit between them. */
  plan?: string[];
  /** What "finished" means, one item per line. */
  acceptance?: string[];
  /** True while the task is paused at a window between plan steps. */
  atWindow?: boolean;
  lastStep?: string;
  /** Something hard to undo that the agent wants to do next. */
  pending?: {
    kind: "merge" | "deploy" | "delete" | "spend" | "send" | "other";
    detail: string;
    diff?: string;
    baseline?: string;
  };
  /** What the agent hands back when it says it's finished. */
  report?: { summary: string; prUrl?: string; testsPassed?: boolean };
  /** Spectral 5-D audit report if pre-evaluated */
  spectral?: SpectralAuditReport;
}

export function evaluateTaskSpectral(task: Task): SpectralAuditReport | null {
  if (task.spectral) return task.spectral;

  if (task.pending?.diff && task.pending.diff.trim().length > 0) {
    return scoreSpectralDiff(task.pending.diff, task.pending.baseline);
  }

  if (task.pending?.detail) {
    const text = task.pending.detail.trim();
    const isCodeOrDiff =
      text.includes("diff --git") ||
      text.includes("@@") ||
      /\b(function|def|class|interface|export|import|const|var|let)\b/.test(text) ||
      (text.includes("\n") && text.length > 50);

    if (isCodeOrDiff) {
      return scoreSpectralDiff(text, task.pending.baseline);
    }
  }

  return null;
}

/** Board-wide context some gates need. */
export interface Board {
  projects: string[];
}

/** Every gate takes the same input, so the harness can call any of them the same way. */
export interface GateInput {
  task: Task;
  board: Board;
}

// ── 1 · intake ───────────────────────────────────────────────────────────────

export const intake = defineGate({
  name: "intake",
  where: "A new task lands on the board",
  actions: { ready: "low", clarify: "low", inbox: "low" },
  see: ({ task }: GateInput) => ({ task: { title: task.title, brief: task.brief } }),
  ask: ({ board }: GateInput) => ({
    project: choice("Which project does `task` belong to?", {
      ...Object.fromEntries(board.projects.map((name) => [name, null])),
      none: "None of the listed projects fits.",
    }),
    urgency: score("How urgent is `task`?", [
      "Whenever: no deadline or blocker mentioned.",
      "Soon: should happen this week.",
      "Now: something is blocked or broken until this is done.",
    ]),
    defined: noul("Does `task.brief` say what finished looks like?"),
  }),
  decide: ({ project, urgency, defined }) => {
    const clear = defined.noul >= 0.5;
    return {
      action: clear ? "ready" : "clarify",
      confidence: Math.min(project.confidence, sureness(defined.noul)),
      why: clear ? `Ready · ${project.choice}` : "The brief doesn't say what done looks like",
      details: { project: project.choice, urgency: Number(position(urgency).toFixed(2)) },
    };
  },
  fallback: { action: "inbox", outcome: "act", why: "Parked in the inbox, unsorted" },
});

// ── 2 · route ────────────────────────────────────────────────────────────────

export const route = defineGate({
  name: "route",
  where: "Before dispatch: who takes this task?",
  actions: { jules: "medium", writer: "medium", person: "low", split: "low", hold: "low" },
  rules: ({ task }: GateInput) =>
    task.repo ? null : { action: "hold", outcome: "escalate", why: "No repo, no dispatch: attach a GitHub repo first" },
  see: ({ task }: GateInput) => ({ task: { title: task.title, brief: task.brief, plan: task.plan ?? [] } }),
  ask: {
    owner: choice("Who should do `task`?", {
      jules: "Writing or changing code in a repository.",
      writer: "Writing, planning or research: words, not code.",
      person: "Needs a human decision, a taste call, or access no model has.",
    }),
    size: score("How much work is `task`?", [
      "Small: one obvious change.",
      "Medium: a few steps with a clear path.",
      "Large: many steps, or the path is unclear.",
    ]),
  },
  decide: ({ owner, size }) => {
    const tooBig = size.score >= 1.5 && owner.choice !== "person";
    return {
      action: tooBig ? "split" : owner.choice,
      confidence: tooBig ? size.confidence : owner.confidence,
      why: tooBig ? "Too big for one pass: split it into smaller tiles" : `${owner.choice} (${pct(owner.confidence)} sure)`,
      details: { size: Number(position(size).toFixed(2)) },
    };
  },
  fallback: { action: "person", outcome: "escalate", why: "A person assigns it" },
});

// ── 3 · window ───────────────────────────────────────────────────────────────

export const safeWindow = defineGate({
  name: "window",
  where: "Between plan steps: the only place another model may join",
  actions: { keep_going: "low", open: "medium" },
  rules: ({ task }: GateInput) =>
    task.atWindow
      ? null
      : { action: "keep_going", outcome: "act", why: "Not at a window: other models only join between steps" },
  see: ({ task }: GateInput) => ({ plan: task.plan ?? [], last_step: task.lastStep ?? "" }),
  ask: {
    clean_stop: noul("Is the work described in `last_step` completely finished?"),
    second_look: noul("Would a second model reviewing `last_step` be likely to catch a real problem?"),
    helper: choice("If another model joins now, what role fits best?", {
      reviewer: "Checks the work done so far.",
      specialist: "Takes on a part that needs different expertise.",
      none: "No one needs to join.",
    }),
  },
  decide: ({ clean_stop, second_look, helper }) => {
    if (clean_stop.noul < 0.5) {
      return { action: "keep_going", confidence: sureness(clean_stop.noul), why: "Mid-step: joining now would cause chaos" };
    }
    if (helper.choice === "none" || second_look.noul < 0.5) {
      return {
        action: "keep_going",
        confidence: Math.min(helper.confidence, sureness(second_look.noul)),
        why: "No one needs to join",
      };
    }
    return {
      action: "open",
      confidence: Math.min(sureness(clean_stop.noul), sureness(second_look.noul), helper.confidence),
      why: `Clean stop: bring in a ${helper.choice}`,
      atLeast: "confirm", // adding a model is always your call
      details: { role: helper.choice },
    };
  },
  bands: { low: { act: 0 } }, // carrying on is always safe, so never stop to ask about it
  fallback: { action: "keep_going", outcome: "act", why: "Keep going; the next window gets another look" },
});

// ── 4 · risky ────────────────────────────────────────────────────────────────

export const risky = defineGate({
  name: "risky",
  where: "Before anything hard to undo: merge, deploy, delete, spend, send",
  actions: { run: "high", block: "low" },
  rules: ({ task }: GateInput) => {
    if (!task.pending) return { action: "block", outcome: "escalate", why: "No pending action was given to check" };
    if (task.pending.kind === "delete") return { action: "block", outcome: "escalate", why: "Deletes always go to a person" };

    // ── Spectral Terrain Enforceable Pre-Flight Gate ───────────────
    // Microsecond geometric check (<5ms): flags fatal cold-map proximity and shatter > 0.15
    const spectral = evaluateTaskSpectral(task);
    if (spectral && spectral.verdict === "block") {
      return { action: "block", outcome: "escalate", why: `Spectral block: ${spectral.receipt}` };
    }

    return null;
  },
  // The plan and the proposed action only. Never tool output or fetched pages:
  // content an agent pulled in must not be able to approve its own next step.
  see: ({ task }: GateInput) => ({ approved_plan: task.plan ?? [], action: task.pending ?? null }),
  ask: {
    in_plan: noul("Is `action` one of the steps in `approved_plan`?"),
    blast: score("If `action` turns out to be wrong, how bad is it?", [
      "Easy to undo; affects nothing else.",
      "Undoable with some work.",
      "Hard to undo, or affects other people or money.",
    ]),
  },
  decide: ({ in_plan, blast }, { task }) => {
    if (in_plan.noul < 0.5) {
      return { action: "block", confidence: sureness(in_plan.noul), why: "Not in the approved plan" };
    }

    const spectral = evaluateTaskSpectral(task);
    const isWatch = spectral?.verdict === "watch";
    const atLeast = blast.score >= 1.5 || isWatch ? "escalate" : undefined;

    return {
      action: "run",
      confidence: Math.min(sureness(in_plan.noul), blast.confidence),
      why: isWatch
        ? `In the plan · ${spectral?.receipt || "Spectral review required"}`
        : `In the plan · blast ${blast.score.toFixed(1)} of 2`,
      atLeast,
      details: {
        blast: Number(position(blast).toFixed(2)),
        ...(spectral ? { spectral: spectral as unknown as import("@typesafe-ai/sdk").JsonValue } : {}),
      },
    };
  },
  fallback: { action: "block", outcome: "escalate", why: "Held for you" },
});

// ── 5 · done ─────────────────────────────────────────────────────────────────

export const done = defineGate({
  name: "done",
  where: "An agent says the task is finished",
  actions: { done: "medium", send_back: "low" },
  rules: ({ task }: GateInput) => {
    if (!task.report?.prUrl) return { action: "send_back", outcome: "act", why: "No PR: the work has to land in the repo" };
    if (task.report.testsPassed === false) return { action: "send_back", outcome: "act", why: "Tests are failing" };
    if (!task.acceptance?.length) return { action: "done", outcome: "confirm", why: "No acceptance list, so you make the call" };
    return null;
  },
  see: ({ task }: GateInput) => ({ acceptance: task.acceptance ?? [], report: task.report?.summary ?? "" }),
  // One atomic question per acceptance item, all in the same call.
  ask: ({ task }: GateInput) =>
    Object.fromEntries(
      (task.acceptance ?? []).map((_, i) => [`item_${i}`, noul(`Does \`report\` show that \`acceptance[${i}]\` was done?`)]),
    ),
  decide: (answers, { task }) => {
    const items = task.acceptance ?? [];
    const yes = items.map((_, i) => answers[`item_${i}`]?.noul ?? 0.5);
    const missing = items.filter((_, i) => (yes[i] ?? 0.5) < 0.5);
    if (missing.length === 0) {
      return { action: "done", confidence: Math.min(...yes.map(sureness)), why: `All ${items.length} acceptance items covered` };
    }
    return {
      action: "send_back",
      confidence: Math.max(...yes.filter((p) => p < 0.5).map(sureness)),
      why: `Missing: ${missing.join("; ")}`,
    };
  },
  fallback: { action: "done", outcome: "confirm", why: "You give it the final look" },
});

/** Every gate in one list: handy for rendering them as nodes on the board. */
export const gates = [intake, route, safeWindow, risky, done] as const;
