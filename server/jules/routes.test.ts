import assert from "node:assert/strict";
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { jevGates } from "../jev-plugin.js";
import { JulesClient } from "./client.js";
import { mockJules } from "./mock-jules.js";

let base = "";
let port = 0;
const server = createServer();
const SECRET_KEY = "super-secret-jules-key-12345";

const mock = mockJules({
  sources: [{ name: "sources/github/test-owner/test-repo", id: "src-1" }],
  sessions: {
    "session-existing": {
      id: "session-existing",
      url: "https://jules.google.com/session-existing",
      state: "IN_PROGRESS",
    },
  },
  activities: {
    "session-existing": [
      {
        name: "act-1",
        createTime: "2026-10-19T10:00:00Z",
        progressUpdated: { title: "Step 1", description: "Doing step 1" },
      },
    ],
  },
});

const julesClient = new JulesClient({
  apiKey: SECRET_KEY,
  fetch: mock,
});

before(async () => {
  let handler: ((req: IncomingMessage, res: ServerResponse, next: () => void) => void) | undefined;
  const plugin = jevGates({ JULES_API_KEY: SECRET_KEY }, { julesClient });
  const mount = plugin.configureServer as unknown as (s: unknown) => void;
  mount({ middlewares: { use: (fn: typeof handler) => (handler = fn) } });

  server.on("request", (req, res) =>
    handler?.(req, res, () => {
      res.statusCode = 404;
      res.end();
    })
  );

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});

after(() => server.close());

function rawRequest(
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path,
        method: options.method || "GET",
        headers: options.headers,
      },
      (res) => {
        let text = "";
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
      }
    );
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

test("GET /api/jules returns the mode and connected repos", async () => {
  const res = await fetch(`${base}/api/jules`);
  assert.equal(res.status, 200);
  const data = (await res.json()) as { mode: string; repos: string[] };
  assert.equal(data.mode, "live");
  assert.deepEqual(data.repos, ["test-owner/test-repo"]);
});

test("POST /api/jules/dispatch creates a session and enforces repo rules", async () => {
  // Missing repo
  const noRepoRes = await fetch(`${base}/api/jules/dispatch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tile: { title: "Do work" }, project: {} }),
  });
  assert.equal(noRepoRes.status, 400);
  const noRepoData = (await noRepoRes.json()) as { error: string };
  assert.equal(noRepoData.error, "Set this project's repo in src/data/initialData.js.");

  // Placeholder repo
  const placeholderRes = await fetch(`${base}/api/jules/dispatch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tile: { title: "Do work" }, project: { repo: "your-org/harness" } }),
  });
  assert.equal(placeholderRes.status, 400);

  // Valid repo
  const validRes = await fetch(`${base}/api/jules/dispatch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tile: { id: "TSK-1", title: "Add auth", description: "Implement oauth", subtasks: ["Setup", "Test"] },
      project: { repo: "test-owner/test-repo", branch: "feature" },
    }),
  });
  assert.equal(validRes.status, 200);
  const validData = (await validRes.json()) as { sessionId: string; url: string };
  assert.ok(validData.sessionId);
  assert.ok(validData.url);
});

test("Foreign Host gets 403 on both /api/gate and /api/jules", async () => {
  const gateRes = await rawRequest("/api/gate", {
    headers: { Host: "attacker.example.com" },
  });
  assert.equal(gateRes.status, 403);

  const julesRes = await rawRequest("/api/jules", {
    headers: { Host: "attacker.example.com" },
  });
  assert.equal(julesRes.status, 403);
});

test("Foreign Origin gets 403 on both /api/gate and /api/jules", async () => {
  const gateRes = await fetch(`${base}/api/gate`, {
    headers: { Origin: "http://evil.com" },
  });
  assert.equal(gateRes.status, 403);

  const julesRes = await fetch(`${base}/api/jules`, {
    headers: { Origin: "http://evil.com" },
  });
  assert.equal(julesRes.status, 403);
});

test("Approve without JSON content-type gets 415", async () => {
  const res = await fetch(`${base}/api/jules/session-existing/approve`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  });
  assert.equal(res.status, 415);
});

test("A bad session ID gets 400", async () => {
  const badId = "session!@#$illegal";
  const res = await fetch(`${base}/api/jules/${badId}`);
  assert.equal(res.status, 400);
});

test("Session not found returns 404 with exact message", async () => {
  const res = await fetch(`${base}/api/jules/session-not-there`);
  assert.equal(res.status, 404);
  const data = (await res.json()) as { error: string };
  assert.equal(data.error, "Jules session not found");
});

test("No response ever contains the API key", async () => {
  const endpoints = [
    `${base}/api/jules`,
    `${base}/api/jules/session-existing`,
  ];
  for (const ep of endpoints) {
    const res = await fetch(ep);
    const text = await res.text();
    assert.equal(text.includes(SECRET_KEY), false, `Response from ${ep} must not contain API key`);
  }
});

test("POST /api/spectral/score returns 5-D structural fingerprint and cold distance in <5ms", async () => {
  const sampleCode = `
    import { z } from 'zod';
    export const ConfigSchema = z.object({ id: z.string() });
    export function parse(input: unknown) { return ConfigSchema.parse(input); }
  `;
  const res = await fetch(`${base}/api/spectral/score`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: sampleCode }),
  });
  assert.equal(res.status, 200);
  const data = (await res.json()) as any;
  assert.equal(data.mode, "5-D structural");
  assert.equal(data.vector.length, 5);
  assert.equal(typeof data.shatter, "number");
  assert.equal(typeof data.coldDistance, "number");
  assert.equal(typeof data.computeTimeMs, "number");
  assert.ok(data.computeTimeMs < 15, `must score in microsecond time (<15ms), was ${data.computeTimeMs}ms`);
});

test("POST /api/spectral/score validates payload and method", async () => {
  const getRes = await fetch(`${base}/api/spectral/score`);
  assert.equal(getRes.status, 405);

  const badRes = await fetch(`${base}/api/spectral/score`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wrongField: 123 }),
  });
  assert.equal(badRes.status, 400);
});

test("GET /api/discovery/stats returns indexed endpoints and join keys", async () => {
  const res = await fetch(`${base}/api/discovery/stats`);
  assert.equal(res.status, 200);
  const data = (await res.json()) as any;
  assert.ok(data.totalEndpoints > 20);
  assert.ok(data.totalJoinKeys >= 12);
  assert.ok(data.totalCrosswalkBridges >= 5);
});

test("GET /api/discovery/hypotheses and POST /api/discovery/dispatch create executable Jules task", async () => {
  const hypRes = await fetch(`${base}/api/discovery/hypotheses`);
  assert.equal(hypRes.status, 200);
  const hypData = (await hypRes.json()) as any;
  assert.ok(hypData.hypotheses.length > 0);
  const candidate = hypData.hypotheses[0];

  const dispatchRes = await fetch(`${base}/api/discovery/dispatch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hypothesisId: candidate.id }),
  });
  assert.equal(dispatchRes.status, 200);
  const dispatchData = (await dispatchRes.json()) as any;
  assert.equal(dispatchData.success, true);
  assert.ok(dispatchData.task.id.startsWith("TSK-"));
  assert.ok(dispatchData.task.branch.startsWith("exp/"));
  assert.ok(dispatchData.task.pending.diff.length > 0);
  assert.equal(dispatchData.task.acceptanceCriteria.length, 4);
});

test("GET /api/discovery/gql returns valid BigQuery GQL DDL", async () => {
  const res = await fetch(`${base}/api/discovery/gql`);
  assert.equal(res.status, 200);
  const data = (await res.json()) as any;
  assert.ok(data.ddl.includes("CREATE OR REPLACE PROPERTY GRAPH"));
  assert.ok(data.ddl.includes("NODE TABLES"));
  assert.ok(data.ddl.includes("EDGE TABLES"));
});

