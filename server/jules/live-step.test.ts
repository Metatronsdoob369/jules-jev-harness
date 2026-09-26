import assert from "node:assert/strict";
import test from "node:test";
import { evalLiveStep } from "../../src/jules/live-step.js";

test("live-step: each state asks once", async () => {
  const tile = { id: "TSK-101", column: "IN_PROGRESS" };
  const sView = {
    id: "sess-1",
    state: "AWAITING_PLAN_APPROVAL",
    newestActivityName: "act-plan-1",
  };

  // First call: should return question
  const res1 = await evalLiveStep(tile, sView);
  assert.ok(res1.question);
  assert.equal(res1.question.kind, "jules_plan");
  assert.equal(res1.question.stateKey, "AWAITING_PLAN_APPROVAL:act-plan-1");

  // Tile with askedFor set (after user answered NO or question shown): should NOT return question again
  const updatedTile = { ...tile, askedFor: "AWAITING_PLAN_APPROVAL:act-plan-1" };
  const res2 = await evalLiveStep(updatedTile, sView);
  assert.equal(res2.question, null);
});

test("live-step: NO doesn't bring the question back", async () => {
  const tile = {
    id: "TSK-102",
    column: "IN_PROGRESS",
    askedFor: "AWAITING_PLAN_APPROVAL:act-plan-1",
    needsYou: "Plan feedback required",
  };
  const sView = {
    id: "sess-1",
    state: "AWAITING_PLAN_APPROVAL",
    newestActivityName: "act-plan-1",
  };

  const res = await evalLiveStep(tile, sView);
  assert.equal(res.question, null);
  assert.equal(tile.needsYou, "Plan feedback required");
});

test("live-step: COMPLETED runs done and risky gates once", async () => {
  const tile = { id: "TSK-103", column: "IN_PROGRESS" };
  const sView = {
    id: "sess-1",
    state: "COMPLETED",
    newestActivityName: "act-done-1",
    report: { prUrl: "https://github.com/org/repo/pull/1" },
  };

  const gateCalls: string[] = [];
  const runGate = async (name: string) => {
    gateCalls.push(name);
    if (name === "done") return { action: "done", verdict: "act" };
    if (name === "risky") return { action: "run", verdict: "confirm" };
    return {};
  };

  const res1 = await evalLiveStep(tile, sView, runGate);
  assert.deepEqual(gateCalls, ["done", "risky"]);
  assert.ok(res1.question);
  assert.equal(res1.question.kind, "jules_pr");

  // Second call with askedFor set: gate should not re-run
  const updatedTile = { ...tile, askedFor: "COMPLETED:act-done-1" };
  gateCalls.length = 0;
  const res2 = await evalLiveStep(updatedTile, sView, runGate);
  assert.deepEqual(gateCalls, []);
  assert.equal(res2.question, null);
});

test("live-step: risky block never opens anything and flags tile", async () => {
  const tile = { id: "TSK-104", column: "IN_PROGRESS" };
  const sView = {
    id: "sess-1",
    state: "COMPLETED",
    newestActivityName: "act-done-2",
    report: { prUrl: "https://github.com/org/repo/pull/2" },
  };

  const runGate = async (name: string) => {
    if (name === "done") return { action: "done", verdict: "act" };
    if (name === "risky") return { action: "block", verdict: "act", reason: "Blocked due to untrusted changes" };
    return {};
  };

  const res = await evalLiveStep(tile, sView, runGate);
  assert.equal(res.question, null);
  assert.equal(res.patch.needsYou, "Blocked due to untrusted changes");
  assert.equal(res.patch.handledCompleted, true);
});

test("live-step: window gate request has atWindow: true and a string lastStep", async () => {
  const tile = { id: "TSK-105", column: "IN_PROGRESS" };
  const sView = {
    id: "sess-1",
    state: "IN_PROGRESS",
    lastStep: { title: "Step 2", description: "Writing vitest tests" },
    newestActivityName: "act-prog-1",
  };

  let capturedExtra: any = null;
  const runGate = async (name: string, extra: any) => {
    if (name === "window") {
      capturedExtra = extra;
      return { action: "open", verdict: "confirm" };
    }
    return {};
  };

  const res = await evalLiveStep(tile, sView, runGate);
  assert.ok(capturedExtra);
  assert.equal(capturedExtra.atWindow, true);
  assert.equal(capturedExtra.lastStep, "Step 2: Writing vitest tests");
  assert.ok(res.question);
  assert.equal(res.question.kind, "jules_window_open");
  assert.ok(res.question.text.includes("Review TSK-105 in Jules now?"));
});
