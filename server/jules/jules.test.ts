import assert from "node:assert/strict";
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { jevGates } from "../jev-plugin.js";
import { JulesClient } from "./client.js";
import { mockJules } from "./mock-jules.js";
import { buildSessionView, isTestRunnerCommand } from "./session-view.js";

// ── HTTP Server setup for route testing ─────────────────────────────────────

let base = "";
let serverPort = 0;
const server = createServer();

before(async () => {
  let handler: ((req: IncomingMessage, res: ServerResponse, next: () => void) => void) | undefined;
  const mockFetch = mockJules({ connectedRepos: ["owner/valid-repo"] }) as typeof fetch;
  const plugin = jevGates({ JULES_API_KEY: "secret-jules-key" }, { julesFetch: mockFetch });
  const mount = plugin.configureServer as unknown as (s: unknown) => void;
  mount({ middlewares: { use: (fn: typeof handler) => (handler = fn) } });
  server.on("request", (req, res) =>
    handler?.(req, res, () => {
      res.statusCode = 404;
      res.end();
    })
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  serverPort = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${serverPort}`;
});

after(() => server.close());

function rawRequest(path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port: serverPort, path, method: "GET", headers }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

// ── HTTP Route Tests ────────────────────────────────────────────────────────

test("GET /api/jules returns mode and repos", async () => {
  const res = await fetch(`${base}/api/jules`);
  assert.equal(res.status, 200);
  const data = (await res.json()) as { mode: string; repos: string[] };
  assert.equal(data.mode, "live");
  assert.ok(Array.isArray(data.repos));
  assert.deepEqual(data.repos, ["owner/valid-repo"]);
});

test("Dispatch is refused with no repo and with placeholder repo", async () => {
  const noRepoRes = await fetch(`${base}/api/jules/dispatch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tile: { title: "Test task" }, project: {} }),
  });
  assert.equal(noRepoRes.status, 400);
  assert.deepEqual(await noRepoRes.json(), { error: "Set this project's repo in src/data/initialData.js." });

  const placeholderRes = await fetch(`${base}/api/jules/dispatch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tile: { title: "Test task" }, project: { repo: "your-org/harness" } }),
  });
  assert.equal(placeholderRes.status, 400);
  assert.deepEqual(await placeholderRes.json(), { error: "Set this project's repo in src/data/initialData.js." });
});

test("A foreign Host gets 403 on both /api/gate and /api/jules", async () => {
  const gateRes = await rawRequest("/api/gate", { host: "attacker.example" });
  assert.equal(gateRes.status, 403);

  const julesRes = await rawRequest("/api/jules", { host: "attacker.example" });
  assert.equal(julesRes.status, 403);
});

test("A foreign Origin gets 403 on both /api/gate and /api/jules", async () => {
  const gateRes = await fetch(`${base}/api/gate`, {
    headers: { origin: "http://attacker.example" },
  });
  assert.equal(gateRes.status, 403);

  const julesRes = await fetch(`${base}/api/jules`, {
    headers: { origin: "http://attacker.example" },
  });
  assert.equal(julesRes.status, 403);
});

test("Approve without JSON gets 415", async () => {
  const res = await fetch(`${base}/api/jules/sess-123/approve`, {
    method: "POST",
  });
  assert.equal(res.status, 415);
});

test("A bad session ID gets 400", async () => {
  const res = await fetch(`${base}/api/jules/bad@session!id/approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
});

test("Both 404 messages are right", async () => {
  // Source 404: when dispatching with unconnected valid repo
  const dispatchRes = await fetch(`${base}/api/jules/dispatch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tile: { title: "Test task" }, project: { repo: "unconnected/repo" } }),
  });
  assert.equal(dispatchRes.status, 400);
  const dispatchBody = (await dispatchRes.json()) as { error: string };
  assert.equal(dispatchBody.error, "repo not connected to Jules (install the Jules GitHub app on it)");

  // Session 404
  const sessionRes = await fetch(`${base}/api/jules/nonexistent123`);
  assert.equal(sessionRes.status, 404);
  const sessionBody = (await sessionRes.json()) as { error: string };
  assert.equal(sessionBody.error, "Jules session not found");
});

test("No response ever contains the key", async () => {
  const res = await fetch(`${base}/api/jules`);
  const text = await res.text();
  assert.ok(!text.includes("secret-jules-key"));
});

// ── Session View Unit Tests ──────────────────────────────────────────────────

test("A mock session with 45 activities over two pages gives lastStep from the 45th", async () => {
  const activities = Array.from({ length: 45 }, (_, i) => ({
    name: `act-${i + 1}`,
    createTime: new Date(Date.now() + (i + 1) * 1000).toISOString(),
    progressUpdated: {
      title: `Step ${i + 1}`,
      description: `Description ${i + 1}`,
    },
  }));

  const mockSession = { id: "sess-45", state: "IN_PROGRESS" };
  const mockFetch = mockJules({
    sessions: {
      "sess-45": { session: mockSession, activities },
    },
  }) as typeof fetch;

  const client = new JulesClient({ fetch: mockFetch });
  const { activities: fetchedActs, capped } = await client.listAllActivities("sess-45");

  assert.equal(fetchedActs.length, 45);
  assert.equal(capped, false);

  const view = buildSessionView(mockSession, fetchedActs, capped);
  assert.equal(view.lastStep?.title, "Step 45");
  assert.equal(view.lastStep?.description, "Description 45");
});

test("Activities in the wrong order still give the newest step", () => {
  const mockSession = { id: "sess-order", state: "IN_PROGRESS" };
  const activities = [
    {
      name: "act-newest",
      createTime: "2025-01-02T12:00:00Z",
      progressUpdated: { title: "Newest Step", description: "This is newest" },
    },
    {
      name: "act-oldest",
      createTime: "2025-01-01T12:00:00Z",
      progressUpdated: { title: "Oldest Step", description: "This is oldest" },
    },
  ];

  const view = buildSessionView(mockSession, activities);
  assert.equal(view.lastStep?.title, "Newest Step");
  assert.equal(view.newestActivityName, "act-newest");
});

test("git checkout and npm run typecheck don't set testsPassed", () => {
  assert.equal(isTestRunnerCommand("git checkout -b feature"), false);
  assert.equal(isTestRunnerCommand("npm run typecheck"), false);
  assert.equal(isTestRunnerCommand("cat test/gate.test.ts"), false);

  assert.equal(isTestRunnerCommand("npm test"), true);
  assert.equal(isTestRunnerCommand("npm run test"), true);
  assert.equal(isTestRunnerCommand("pnpm test"), true);
  assert.equal(isTestRunnerCommand("yarn test"), true);
  assert.equal(isTestRunnerCommand("node --test"), true);
  assert.equal(isTestRunnerCommand("tsx --test"), true);
  assert.equal(isTestRunnerCommand("vitest"), true);
  assert.equal(isTestRunnerCommand("jest"), true);
  assert.equal(isTestRunnerCommand("pytest"), true);

  const mockSession = { id: "sess-cmd", state: "IN_PROGRESS" };
  const activities = [
    {
      artifacts: [
        { bashOutput: { command: "git checkout -b fix", exitCode: 0 } },
        { bashOutput: { command: "npm run typecheck", exitCode: 0 } },
      ],
    },
  ];

  const view = buildSessionView(mockSession, activities);
  assert.equal(view.report.testsPassed, undefined);
});

test("JulesClient dispatch request body formatting and mock routing", async () => {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetchMock = mockJules({ calls }) as typeof fetch;
  const client = new JulesClient({ apiKey: "test-key", fetch: fetchMock });

  const session = await client.createSession({
    prompt: "Test prompt",
    title: "Test Task",
    source: "sources/github/your-org/harness",
    startingBranch: "main",
  });

  assert.equal(session.state, "PLANNING");
  assert.ok(session.id);
  assert.ok(session.url?.includes(session.id!));

  const createCall = calls.find((c) => c.method === "POST" && c.url.endsWith("/sessions"));
  assert.ok(createCall);
  const body = createCall.body as any;
  assert.equal(body.prompt, "Test prompt");
  assert.equal(body.title, "Test Task");
  assert.equal(body.sourceContext.source, "sources/github/your-org/harness");
  assert.equal(body.sourceContext.githubRepoContext.startingBranch, "main");
  assert.equal(body.requirePlanApproval, true);
  assert.equal(body.automationMode, "AUTO_CREATE_PR");
});
