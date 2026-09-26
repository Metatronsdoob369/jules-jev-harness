import assert from "node:assert/strict";
import test from "node:test";
import { createRunner } from "../jev/gate.js";
import { mockJev } from "../jev/mock-jev.js";
import { runNamed, toGateInput } from "../jev/harness.js";

test("simulated mode: tile advances and reaches done gate", async () => {
  const runner = createRunner({
    clientConfig: { apiKey: "stand-in", fetch: mockJev({ latencyMs: 1 }), logLevel: "off" },
  });

  const tile = {
    id: "TSK-301",
    title: "Simulated task",
    description: "Build feature",
    column: "IN_PROGRESS",
    progress: 80,
    subtasks: ["Build component"],
    checkpointActive: true,
  };

  const report = {
    summary: "Completed: Build component.",
    prUrl: `sim://${tile.id}`,
    testsPassed: true,
  };

  const input = toGateInput({
    tile,
    report,
    project: { name: "Harness", repo: "your-org/harness" },
  });

  const verdict = await runNamed(runner, "done", input);
  assert.equal(verdict.gate, "done");
  assert.ok(verdict.action === "done" || verdict.action === "send_back");
});
