import assert from "node:assert/strict";
import { test } from "node:test";
import { mockJev, type MockOptions } from "./mock-jev.js";
import { DEFAULT_BANDS, createRunner, looksLikeSecret, mostCareful, outcomeFor, sureness } from "./gate.js";
import { done, intake, risky, route, safeWindow, type GateInput, type Task } from "./gates.js";

const board = { projects: ["harness", "co-lab"] };
const base: Task = {
  id: "T-1",
  title: "Hover specs",
  brief: "Show tokens on hover. Done when it appears within 150 ms.",
  repo: "your-org/harness",
  plan: ["Build the hover card", "Wire telemetry"],
  acceptance: ["Hover shows tokens", "Appears within 150 ms"],
};
const input = (patch: Partial<Task> = {}): GateInput => ({ task: { ...base, ...patch }, board });

function runnerWith(options: MockOptions = {}) {
  const calls: unknown[] = [];
  const runner = createRunner({ clientConfig: { apiKey: "test", fetch: mockJev({ ...options, calls }), logLevel: "off" } });
  return { run: runner.run, calls };
}

const merge = { kind: "merge" as const, detail: "Merge PR #12 into main" };
const report = { summary: "Hover shows tokens and appears in 90 ms.", prUrl: "https://github.com/x/y/pull/12", testsPassed: true };

test("bands: sureness x stakes -> outcome", () => {
  assert.equal(outcomeFor(0.8, DEFAULT_BANDS.medium), "act");
  assert.equal(outcomeFor(0.6, DEFAULT_BANDS.medium), "confirm");
  assert.equal(outcomeFor(0.3, DEFAULT_BANDS.medium), "escalate");
  assert.equal(outcomeFor(0.99, DEFAULT_BANDS.high), "confirm", "high stakes never act on their own");
  assert.equal(mostCareful("act", "confirm"), "confirm");
  assert.equal(mostCareful("escalate", "confirm"), "escalate");
  assert.equal(sureness(0.5), 0);
  assert.ok(Math.abs(sureness(0.95) - 0.9) < 1e-9);
});

test("one task through all five gates", async () => {
  const { run } = runnerWith();
  const a = await run(intake, input());
  assert.deepEqual([a.outcome, a.action, a.details?.project], ["act", "ready", "harness"]);
  const b = await run(route, input());
  assert.deepEqual([b.outcome, b.action], ["act", "jules"]);
  const c = await run(safeWindow, input({ atWindow: true, lastStep: "Built the hover card." }));
  assert.deepEqual([c.outcome, c.action], ["confirm", "open"], "adding a model always needs a yes");
  const d = await run(risky, input({ pending: merge }));
  assert.deepEqual([d.outcome, d.action], ["confirm", "run"], "high stakes cap at confirm");
  const e = await run(done, input({ report }));
  assert.deepEqual([e.outcome, e.action], ["act", "done"]);
  for (const v of [a, b, c, d, e]) assert.equal(v.source, "jev");
});

test("the documented wire format goes out through the real SDK", async () => {
  const { run, calls } = runnerWith();
  await run(route, input());
  const sent = calls[0] as { model: string; state: unknown; questions: Record<string, { type: string; criteria: unknown }> };
  assert.equal(sent.model, "jev-latest");
  assert.equal(typeof sent.state, "object");
  assert.equal(sent.questions.owner?.type, "choice");
  assert.equal(sent.questions.size?.type, "score");
  assert.ok(Array.isArray(sent.questions.size?.criteria));
});

test("rules run first and cost nothing", async () => {
  const { run, calls } = runnerWith();
  const v = await run(route, input({ repo: undefined }));
  assert.deepEqual([v.source, v.outcome, v.action], ["rule", "escalate", "hold"]);
  const w = await run(safeWindow, input({ atWindow: false }));
  assert.deepEqual([w.source, w.action], ["rule", "keep_going"]);
  const x = await run(done, input({ report: { summary: "done", testsPassed: true } }));
  assert.deepEqual([x.source, x.action], ["rule", "send_back"], "no PR, no done");
  assert.equal(calls.length, 0, "Jev was never called");
});

test("a secret never leaves", async () => {
  const { run, calls } = runnerWith();
  const fakeKey = "sk-" + "x".repeat(24);
  assert.ok(looksLikeSecret(fakeKey));
  assert.ok(!looksLikeSecret("Merge PR #12 into main"));
  const v = await run(risky, input({ pending: { kind: "deploy", detail: `Deploy with ${fakeKey}` } }));
  assert.deepEqual([v.source, v.outcome, v.action], ["fallback", "escalate", "block"]);
  assert.equal(calls.length, 0);
});

test("slow Jev: the fallback fires inside the budget", async () => {
  const { run } = runnerWith({ latencyMs: 2_000 });
  const started = Date.now();
  const v = await run({ ...route, budgetMs: 100 }, input());
  assert.equal(v.source, "fallback");
  assert.deepEqual([v.outcome, v.action], ["escalate", "person"]);
  assert.match(v.why, /no answer within 100 ms/);
  assert.ok(Date.now() - started < 1_000, "didn't wait on Jev");
});

test("bad key: falls back instead of crashing", async () => {
  const { run } = runnerWith({ status: 401 });
  const v = await run(route, input());
  assert.equal(v.source, "fallback");
  assert.match(v.why, /API key missing or invalid/);
});

test("risky: a big blast radius always goes to a person", async () => {
  const { run } = runnerWith({ script: { blast: { level: 2, p: 0.9 } } });
  const v = await run(risky, input({ pending: merge }));
  assert.deepEqual([v.outcome, v.action], ["escalate", "run"]);
});

test("risky: not in the plan gets blocked", async () => {
  const { run } = runnerWith({ script: { in_plan: { p: 0.04 } } });
  const v = await run(risky, input({ pending: { kind: "spend", detail: "Buy a $400 GPU credit pack" } }));
  assert.deepEqual([v.outcome, v.action], ["act", "block"]);
});

test("done: a missing acceptance item sends it back, and says which", async () => {
  const { run } = runnerWith({ script: { item_1: { p: 0.1 } } });
  const v = await run(done, input({ report }));
  assert.deepEqual([v.outcome, v.action], ["act", "send_back"]);
  assert.match(v.why, /Appears within 150 ms/);
});

test("window: when Jev is unsure, carrying on never stops to ask", async () => {
  const { run } = runnerWith({ script: { clean_stop: { p: 0.45 } } });
  const v = await run(safeWindow, input({ atWindow: true, lastStep: "Half of the hover card." }));
  assert.deepEqual([v.outcome, v.action], ["act", "keep_going"]);
});

test("intake: an unclear brief goes to clarify", async () => {
  const { run } = runnerWith({ script: { defined: { p: 0.12 } } });
  const v = await run(intake, input({ brief: "make the board better" }));
  assert.deepEqual([v.outcome, v.action], ["act", "clarify"]);
});
