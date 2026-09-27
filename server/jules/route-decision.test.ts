import assert from "node:assert/strict";
import test from "node:test";
import { evalRouteDecision } from "../../src/jules/route-decision.js";

test("route-decision: hold, person and split never start work and flag tile", () => {
  const tile = { id: "TSK-201" };
  const project = { repo: "owner/repo" };

  for (const action of ["hold", "person", "split"]) {
    const res = evalRouteDecision(
      { action, verdict: "act", reason: `Reason for ${action}` },
      "live",
      tile,
      project
    );
    assert.equal(res.action, "hold");
    assert.equal(res.patch?.needsYou, `Reason for ${action}`);
    assert.equal(res.question, undefined);
  }
});

test("route-decision: live mode jules route always asks even on verdict 'act'", () => {
  const tile = { id: "TSK-202" };
  const project = { repo: "owner/repo" };

  const resAct = evalRouteDecision(
    { action: "jules", verdict: "act", reason: "Auto route" },
    "live",
    tile,
    project
  );
  assert.equal(resAct.action, "dispatch_jules");
  assert.ok(resAct.question);
  assert.equal(resAct.question.text, "Start a Jules session for TSK-202?");

  const resConfirm = evalRouteDecision(
    { action: "jules", verdict: "confirm", reason: "Confirm route" },
    "live",
    tile,
    project
  );
  assert.equal(resConfirm.action, "dispatch_jules");
  assert.ok(resConfirm.question);
  assert.equal(resConfirm.question.text, "Start a Jules session for TSK-202?");
});

test("route-decision: live mode jules refuses placeholder repo", () => {
  const tile = { id: "TSK-203" };
  const project = { repo: "your-org/harness" };

  const res = evalRouteDecision(
    { action: "jules", verdict: "act", reason: "Auto route" },
    "live",
    tile,
    project
  );
  assert.equal(res.action, "hold");
  assert.equal(res.patch?.needsYou, "Set this project's repo in src/data/initialData.js.");
});

test("route-decision: simulated mode routes jules and writer correctly", () => {
  const tile = { id: "TSK-204" };

  const julesAct = evalRouteDecision(
    { action: "jules", verdict: "act", reason: "Auto route" },
    "simulated",
    tile
  );
  assert.equal(julesAct.action, "start_simulated_jules");
  assert.equal(julesAct.question, undefined);

  const julesConfirm = evalRouteDecision(
    { action: "jules", verdict: "confirm", reason: "Confirm route" },
    "simulated",
    tile
  );
  assert.equal(julesConfirm.action, "start_simulated_jules");
  assert.ok(julesConfirm.question);

  const writerAct = evalRouteDecision(
    { action: "writer", verdict: "act", reason: "Auto route" },
    "simulated",
    tile
  );
  assert.equal(writerAct.action, "start_simulated_writer");

  const writerConfirm = evalRouteDecision(
    { action: "writer", verdict: "confirm", reason: "Confirm route" },
    "simulated",
    tile
  );
  assert.equal(writerConfirm.action, "start_simulated_writer");
  assert.ok(writerConfirm.question);
});
