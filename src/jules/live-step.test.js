import test from "node:test";
import assert from "node:assert/strict";
import { computeLiveStep } from "./live-step.js";

test("live-step: each state asks once, NO does not bring question back", () => {
  const tile = {
    id: "TSK-1",
    column: "IN_PROGRESS",
    askedFor: null,
  };
  const sessionView = {
    id: "s1",
    state: "AWAITING_PLAN_APPROVAL",
    newestActivityName: "act-plan-1",
    plan: ["Step 1", "Step 2"],
  };

  // First poll: should ask for plan approval
  const step1 = computeLiveStep({ tile, sessionView });
  assert.equal(step1.type, "ask_plan");
  assert.equal(step1.askedFor, "AWAITING_PLAN_APPROVAL:act-plan-1");

  // User says NO -> tile is flagged, askedFor is recorded
  const tileAfterNo = {
    ...tile,
    needsYou: "Plan rejected",
    askedFor: step1.askedFor,
  };

  // Next poll with same activity: should be noop (does not ask again!)
  const step2 = computeLiveStep({ tile: tileAfterNo, sessionView });
  assert.equal(step2.type, "noop");
});

test("live-step: window gate open always asks first before opening", () => {
  const tile = {
    id: "TSK-2",
    sessionUrl: "https://jules.google.com/session-2",
    askedFor: null,
  };
  const sessionView = {
    id: "s2",
    state: "IN_PROGRESS",
    lastStep: { title: "Step 2: Checkpoint" },
    newestActivityName: "act-2",
  };
  const windowGateVerdict = {
    action: "open",
    reason: "Second look recommended",
  };

  const step = computeLiveStep({ tile, sessionView, windowGateVerdict });
  assert.equal(step.type, "ask_window_open");
  assert.equal(step.question, "Review TSK-2 in Jules now? (Step 2: Checkpoint)");
  assert.equal(step.sessionUrl, "https://jules.google.com/session-2");

  // Subsequent poll does not re-ask
  const tileAsked = { ...tile, askedFor: step.askedFor };
  const stepRepeat = computeLiveStep({ tile: tileAsked, sessionView, windowGateVerdict });
  assert.equal(stepRepeat.type, "noop");
});

test("live-step: COMPLETED runs gates once and risky block never opens anything", () => {
  const tile = {
    id: "TSK-3",
    askedFor: null,
  };
  const sessionView = {
    id: "s3",
    state: "COMPLETED",
    newestActivityName: "act-complete",
    report: { prUrl: "https://github.com/org/repo/pull/1" },
  };

  // Done gate passed, Risky gate says BLOCK
  const doneGateVerdict = { action: "done", verdict: "act", reason: "All done" };
  const riskyGateVerdict = { action: "block", verdict: "confirm", reason: "Merge forbidden by policy" };

  const step = computeLiveStep({ tile, sessionView, doneGateVerdict, riskyGateVerdict });
  assert.equal(step.type, "flag");
  assert.equal(step.reason, "Merge forbidden by policy");
  assert.ok(step.askedFor);

  // Subsequent poll does nothing
  const tileFlagged = { ...tile, askedFor: step.askedFor };
  const stepRepeat = computeLiveStep({ tile: tileFlagged, sessionView, doneGateVerdict, riskyGateVerdict });
  assert.equal(stepRepeat.type, "noop");
});

test("live-step: risky run asks to open pull request", () => {
  const tile = {
    id: "TSK-4",
    askedFor: null,
  };
  const sessionView = {
    id: "s4",
    state: "COMPLETED",
    newestActivityName: "act-done",
    report: { prUrl: "https://github.com/org/repo/pull/99" },
  };

  const doneGateVerdict = { action: "done", verdict: "act", reason: "All done" };
  const riskyGateVerdict = { action: "run", verdict: "confirm", reason: "Merge approved plan" };

  const step = computeLiveStep({ tile, sessionView, doneGateVerdict, riskyGateVerdict });
  assert.equal(step.type, "ask_open_pr");
  assert.equal(step.question, "Open the pull request for TSK-4?");
  assert.equal(step.prUrl, "https://github.com/org/repo/pull/99");
});

test("live-step: done gate send_back asks Jules to finish missing items", () => {
  const tile = {
    id: "TSK-5",
    askedFor: null,
  };
  const sessionView = {
    id: "s5",
    state: "COMPLETED",
    newestActivityName: "act-partial",
  };

  const doneGateVerdict = { action: "send_back", verdict: "confirm", reason: "Integration test missing" };

  const step = computeLiveStep({ tile, sessionView, doneGateVerdict });
  assert.equal(step.type, "ask_send_back");
  assert.equal(step.question, "Ask Jules to finish: Integration test missing?");
  assert.equal(step.missingItems, "Integration test missing");
});

test("live-step: clears needsYou when Jules advances externally", () => {
  const tile = {
    id: "TSK-6",
    needsYou: "Approve plan",
  };
  const sessionView = {
    id: "s6",
    state: "IN_PROGRESS",
    needsYou: null,
  };

  const step = computeLiveStep({ tile, sessionView });
  assert.equal(step.type, "clear_needs_you");
});
