/**
 * Harness adapter: the only place board tiles meet the gates.
 *
 * The board speaks tiles (title, description, subtasks, progress).
 * The gates speak tasks (brief, plan, acceptance, report).
 * Everything that crosses from the page is size-capped and type-checked here.
 */
import { createRunner } from "./gate.js";
import { done, intake, risky, route, safeWindow, type GateInput, type Task } from "./gates.js";

export const GATE_NAMES = ["intake", "route", "window", "risky", "done"] as const;
export type GateName = (typeof GATE_NAMES)[number];
export const isGateName = (name: string): name is GateName => (GATE_NAMES as readonly string[]).includes(name);

type Runner = ReturnType<typeof createRunner>;

/** Run a gate by name, keeping each gate's own types. */
export function runNamed(runner: Runner, name: GateName, input: GateInput) {
  switch (name) {
    case "intake":
      return runner.run(intake, input);
    case "route":
      return runner.run(route, input);
    case "window":
      return runner.run(safeWindow, input);
    case "risky":
      return runner.run(risky, input);
    case "done":
      return runner.run(done, input);
  }
}

/** Every approved plan ends with the same two steps, so a merge is always "in the plan". */
const CLOSING_STEPS = ["Open a pull request", "Merge the pull request after review"];

const PENDING_KINDS = ["merge", "deploy", "delete", "spend", "send", "other"] as const;

/** What the page sends: one tile, its project, and whatever the moment adds. */
export interface GateRequest {
  tile: { id: string; title: string; description?: string; subtasks?: string[] };
  project?: { name?: string; repo?: string };
  projects?: { name?: string }[];
  atWindow?: boolean;
  lastStep?: string;
  pending?: { kind?: string; detail?: string };
  report?: { summary?: string; prUrl?: string; testsPassed?: boolean };
}

export function toGateInput(body: GateRequest): GateInput {
  const steps = list(body.tile.subtasks);
  const task: Task = {
    id: text(body.tile.id, 40),
    title: text(body.tile.title, 200),
    brief: text(body.tile.description, 2_000),
    project: optional(body.project?.name, 80),
    repo: optional(body.project?.repo, 120),
    plan: [...steps, ...CLOSING_STEPS],
    acceptance: steps,
    atWindow: body.atWindow === true,
    lastStep: optional(body.lastStep, 2_000),
  };
  if (body.pending) {
    const kind = PENDING_KINDS.find((k) => k === body.pending?.kind) ?? "other";
    task.pending = { kind, detail: text(body.pending.detail, 2_000) };
  }
  if (body.report) {
    task.report = {
      summary: text(body.report.summary, 2_000),
      prUrl: optional(body.report.prUrl, 300),
      testsPassed: typeof body.report.testsPassed === "boolean" ? body.report.testsPassed : undefined,
    };
  }
  const projects = (body.projects ?? []).map((p) => text(p?.name, 80)).filter(Boolean).slice(0, 20);
  return { task, board: { projects } };
}

const text = (value: unknown, max: number): string => (typeof value === "string" ? value.slice(0, max) : "");
const optional = (value: unknown, max: number): string | undefined => text(value, max) || undefined;
const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => text(item, 300)).filter(Boolean).slice(0, 12) : [];
