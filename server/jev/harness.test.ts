import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { jevGates } from "../jev-plugin.js";
import { toGateInput } from "./harness.js";

// ── The adapter ──────────────────────────────────────────────────────────────

test("a board tile becomes the task every gate expects", () => {
  const { task, board } = toGateInput({
    tile: { id: "TSK-1", title: "Hover specs", description: "Show tokens on hover.", subtasks: ["Build card", "Wire telemetry"] },
    project: { name: "Harness", repo: "your-org/harness" },
    projects: [{ name: "Harness" }, { name: "Co-lab" }],
  });
  assert.equal(task.brief, "Show tokens on hover.");
  assert.equal(task.repo, "your-org/harness");
  assert.deepEqual(task.acceptance, ["Build card", "Wire telemetry"]);
  assert.deepEqual(task.plan?.slice(-2), ["Open a pull request", "Merge the pull request after review"]);
  assert.deepEqual(board.projects, ["Harness", "Co-lab"]);
});

test("whatever the page sends is capped and type-checked", () => {
  const { task } = toGateInput({
    tile: { id: "TSK-1", title: "x".repeat(900), description: 42 as unknown as string, subtasks: Array(40).fill("step") },
    pending: { kind: "rm -rf", detail: "Run it" },
    report: { summary: "done", testsPassed: "yes" as unknown as boolean },
  });
  assert.equal(task.title.length, 200);
  assert.equal(task.brief, "");
  assert.equal(task.acceptance?.length, 12);
  assert.equal(task.pending?.kind, "other");
  assert.equal(task.report?.testsPassed, undefined);
});

// ── The server route, over real HTTP ─────────────────────────────────────────

let base = "";
const server = createServer();

before(async () => {
  let handler: ((req: IncomingMessage, res: ServerResponse, next: () => void) => void) | undefined;
  const mount = jevGates({}).configureServer as unknown as (s: unknown) => void;
  mount({ middlewares: { use: (fn: typeof handler) => (handler = fn) } });
  server.on("request", (req, res) =>
    handler?.(req, res, () => {
      res.statusCode = 404;
      res.end();
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const tile = { id: "TSK-9", title: "Hover specs", description: "Show tokens on hover.", subtasks: ["Build card"] };
const post = (path: string, body: unknown, type = "application/json") =>
  fetch(`${base}${path}`, { method: "POST", headers: { "content-type": type }, body: JSON.stringify(body) });

test("GET /api/gate reports the mode", async () => {
  const res = await fetch(`${base}/api/gate`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { mode: "stand-in", gates: ["intake", "route", "window", "risky", "done"] });
});

test("POST /api/gate/route returns a real verdict from the runner", async () => {
  const res = await post("/api/gate/route", { tile, project: { name: "Harness", repo: "your-org/harness" } });
  assert.equal(res.status, 200);
  const v = (await res.json()) as { gate: string; action: string; outcome: string; source: string; mode: string };
  assert.deepEqual([v.gate, v.source, v.mode], ["route", "jev", "stand-in"]);
  assert.equal(v.action, "jules");
});

test("no repo, no dispatch, straight from the rule", async () => {
  const res = await post("/api/gate/route", { tile, project: { name: "Harness" } });
  const v = (await res.json()) as { action: string; outcome: string; source: string };
  assert.deepEqual([v.source, v.action, v.outcome], ["rule", "hold", "escalate"]);
});

test("the route refuses anything that isn't a JSON POST to a known gate", async () => {
  assert.equal((await post("/api/gate/route", { tile }, "text/plain")).status, 415);
  assert.equal((await post("/api/gate/nope", { tile })).status, 404);
  assert.equal((await fetch(`${base}/api/gate/route`)).status, 405);
  assert.equal((await post("/api/gate/route", { nothing: true })).status, 400);
});
