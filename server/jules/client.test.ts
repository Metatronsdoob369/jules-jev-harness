import test from "node:test";
import assert from "node:assert/strict";
import { JulesClient } from "./client.js";
import { mockJules } from "./mock-jules.js";

test("JulesClient: throws when API key is missing or invalid", async () => {
  const clientWithoutKey = new JulesClient({});
  await assert.rejects(
    async () => clientWithoutKey.listSources(),
    /Jules key missing or invalid/
  );

  const clientWithBadKey = new JulesClient({
    apiKey: "bad-key",
    fetch: mockJules(),
  });
  await assert.rejects(
    async () => clientWithBadKey.listSources(),
    /Jules key missing or invalid/
  );
});

test("JulesClient: 404 error messages are accurately mapped", async () => {
  // 404 on sources/... -> repo not connected to Jules (install the Jules GitHub app on it)
  const mockSources404: typeof fetch = async (url) => {
    return new Response(JSON.stringify({ error: { message: "Not found" } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  };
  const clientSources = new JulesClient({
    apiKey: "test-key",
    fetch: mockSources404,
  });

  await assert.rejects(
    async () => clientSources.listSources(),
    /repo not connected to Jules \(install the Jules GitHub app on it\)/
  );

  // 404 on sessions/... -> Jules session not found
  const mock = mockJules({
    sources: [],
    sessions: {},
  });
  const client = new JulesClient({
    apiKey: "test-key",
    fetch: mock,
  });

  await assert.rejects(
    async () => client.getSession("non-existent-session"),
    /Jules session not found/
  );
});

test("JulesClient: listSources extracts owner/repo cleanly", async () => {
  const mock = mockJules({
    sources: [
      { name: "sources/github/owner-a/repo-1", id: "s1" },
      { name: "sources/github/owner-b/repo-2", id: "s2" },
    ],
  });
  const client = new JulesClient({
    apiKey: "test-key",
    fetch: mock,
  });

  const res = await client.listSources();
  assert.deepEqual(res.repos, ["owner-a/repo-1", "owner-b/repo-2"]);
});

test("JulesClient: createSession dispatches with required fields", async () => {
  const calls: Array<{ url: string; method: string; body?: unknown; headers: Record<string, string> }> = [];
  const mock = mockJules({
    sources: [{ name: "sources/github/my-org/my-repo", id: "s1" }],
    calls,
  });
  const client = new JulesClient({
    apiKey: "test-key",
    fetch: mock,
  });

  const res = await client.createSession({
    prompt: "Add feature",
    title: "Feature X",
    repo: "my-org/my-repo",
    startingBranch: "develop",
  });

  assert.equal(res.id, "session-1");
  const postCall = calls.find((c) => c.method === "POST" && c.url.includes("/sessions"));
  assert.ok(postCall);
  const body = postCall.body as Record<string, any>;
  assert.equal(body.prompt, "Add feature");
  assert.equal(body.title, "Feature X");
  assert.equal(body.sourceContext.source, "sources/github/my-org/my-repo");
  assert.equal(body.sourceContext.githubRepoContext.startingBranch, "develop");
  assert.equal(body.requirePlanApproval, true);
  assert.equal(body.automationMode, "AUTO_CREATE_PR");
});

test("JulesClient: approvePlan and sendMessage send proper payloads", async () => {
  const calls: Array<{ url: string; method: string; body?: unknown; headers: Record<string, string> }> = [];
  const mock = mockJules({
    sources: [{ name: "sources/github/my-org/my-repo", id: "s1" }],
    calls,
  });
  const client = new JulesClient({
    apiKey: "test-key",
    fetch: mock,
  });

  const session = await client.createSession({
    prompt: "Add feature",
    title: "Feature X",
    repo: "my-org/my-repo",
  });

  await client.approvePlan(session.id);
  const approveCall = calls.find((c) => c.url.includes(":approvePlan"));
  assert.ok(approveCall);
  assert.equal(approveCall.method, "POST");

  await client.sendMessage(session.id, "Please refine the unit test");
  const messageCall = calls.find((c) => c.url.includes(":sendMessage"));
  assert.ok(messageCall);
  assert.equal(messageCall.method, "POST");
  assert.deepEqual(messageCall.body, { prompt: "Please refine the unit test" });
});
