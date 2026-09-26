import assert from "node:assert/strict";
import test from "node:test";
import { JulesClient } from "./client.js";
import { mockJules } from "./mock-jules.js";
import { buildSessionView } from "./session-view.js";

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

test("session-view.ts maps every session state, plan, progress, and lastStep correctly", () => {
  const session = {
    id: "sess-123",
    url: "https://jules.google/session/sess-123",
    state: "IN_PROGRESS",
  };

  const activities = [
    {
      planGenerated: {
        plan: {
          steps: [
            { index: 1, title: "Step One", description: "First" },
            { index: 2, title: "Step Two", description: "Second" },
          ],
        },
      },
    },
    {
      progressUpdated: {
        title: "Step One Done",
        description: "Finished step one",
      },
    },
  ];

  const view = buildSessionView(session, activities);
  assert.equal(view.id, "sess-123");
  assert.equal(view.state, "IN_PROGRESS");
  assert.deepEqual(view.plan, ["Step One", "Step Two"]);
  assert.equal(view.progress, 48);
  assert.deepEqual(view.lastStep, {
    title: "Step One Done",
    description: "Finished step one",
  });
  assert.equal(view.needsYou, null);
});

test("session-view.ts maps outputs PR and test bashOutput into report", () => {
  const session = {
    id: "sess-456",
    state: "COMPLETED",
    outputs: [
      {
        pullRequest: {
          url: "https://github.com/your-org/harness/pull/42",
          title: "PR 42",
          description: "Summary of changes from PR description",
        },
      },
    ],
  };

  const activities = [
    {
      artifacts: [
        {
          bashOutput: {
            command: "npm test",
            output: "18 passed",
            exitCode: 0,
          },
        },
      ],
    },
  ];

  const view = buildSessionView(session, activities);
  assert.equal(view.progress, 100);
  assert.equal(view.report.prUrl, "https://github.com/your-org/harness/pull/42");
  assert.equal(view.report.summary, "Summary of changes from PR description");
  assert.equal(view.report.testsPassed, true);
});

test("session-view.ts maps failure reason and awaiting states into needsYou", () => {
  const failSession = { id: "sess-fail", state: "FAILED" };
  const failActivities = [
    {
      sessionFailed: { reason: "Build error on step 2" },
    },
  ];
  const failView = buildSessionView(failSession, failActivities);
  assert.equal(failView.needsYou, "Build error on step 2");

  const planSession = { id: "sess-plan", state: "AWAITING_PLAN_APPROVAL" };
  const planView = buildSessionView(planSession, []);
  assert.equal(planView.needsYou, "Awaiting plan approval");

  const feedbackSession = { id: "sess-fb", state: "AWAITING_USER_FEEDBACK" };
  const feedbackActivities = [
    {
      agentMessaged: { agentMessage: "Which database should I use?" },
    },
  ];
  const feedbackView = buildSessionView(feedbackSession, feedbackActivities);
  assert.equal(feedbackView.needsYou, "Which database should I use?");
});

test("mockJules handles getSource, approvePlan and sendMessage", async () => {
  const fetchMock = mockJules({
    connectedRepos: ["your-org/harness"],
  }) as typeof fetch;
  const client = new JulesClient({ apiKey: "test-key", fetch: fetchMock });

  const source = await client.getSource("your-org", "harness");
  assert.equal(source.name, "sources/github/your-org/harness");

  await assert.rejects(
    async () => client.getSource("your-org", "unknown-repo"),
    /repo not connected to Jules/
  );

  const session = await client.createSession({
    prompt: "Do work",
    title: "Task",
    source: "sources/github/your-org/harness",
  });

  await client.approvePlan(session.id!);
  const updated = await client.getSession(session.id!);
  assert.equal(updated.state, "IN_PROGRESS");

  await client.sendMessage(session.id!, "User reply");
  const activities = await client.listActivities(session.id!);
  const lastMsg = activities.activities?.find((a) => a.userMessaged?.userMessage === "User reply");
  assert.ok(lastMsg);
});
