import test from "node:test";
import assert from "node:assert/strict";
import { buildSessionView } from "./session-view.js";
import type { JulesActivity, JulesSession } from "./client.js";

test("session-view: sorting activities by createTime handles out-of-order delivery", () => {
  const session: JulesSession = {
    id: "s1",
    url: "https://jules.google.com/sessions/s1",
    state: "IN_PROGRESS",
  };

  const activities: JulesActivity[] = [
    {
      name: "act-3",
      createTime: "2026-10-19T10:00:03Z",
      progressUpdated: { title: "Step 3: Deploy", description: "Deploying build" },
    },
    {
      name: "act-1",
      createTime: "2026-10-19T10:00:01Z",
      planGenerated: {
        plan: {
          steps: [{ title: "Step 1" }, { title: "Step 2" }, { title: "Step 3" }],
        },
      },
    },
    {
      name: "act-2",
      createTime: "2026-10-19T10:00:02Z",
      progressUpdated: { title: "Step 2: Build", description: "Building bundle" },
    },
  ];

  const view = buildSessionView(session, activities);
  assert.equal(view.lastStep?.title, "Step 3: Deploy");
  assert.equal(view.newestActivityName, "act-3");
});

test("session-view: 45 activities over multiple pages returns lastStep from the newest", () => {
  const session: JulesSession = {
    id: "s1",
    url: "https://jules.google.com/sessions/s1",
    state: "IN_PROGRESS",
  };

  const activities: JulesActivity[] = [];
  for (let i = 1; i <= 45; i++) {
    const time = new Date(1700000000000 + i * 1000).toISOString();
    activities.push({
      name: `act-${i}`,
      createTime: time,
      progressUpdated: {
        title: `Step ${i}`,
        description: `Running step ${i}`,
      },
    });
  }

  const view = buildSessionView(session, activities);
  assert.equal(view.lastStep?.title, "Step 45");
  assert.equal(view.newestActivityName, "act-45");
});

test("session-view: test runner whitelist: only real test commands set testsPassed", () => {
  const session: JulesSession = {
    id: "s1",
    url: "https://jules.google.com/sessions/s1",
    state: "IN_PROGRESS",
  };

  // Commands that contain "check" or "test" but are NOT test suites
  const nonTestActivities: JulesActivity[] = [
    {
      name: "act-1",
      createTime: "2026-10-19T10:00:01Z",
      artifacts: [
        {
          bashOutput: {
            command: "git checkout -b fix/issue",
            output: "Switched to branch",
            exitCode: 0,
          },
        },
        {
          bashOutput: {
            command: "npm run typecheck",
            output: "Found 0 errors",
            exitCode: 0,
          },
        },
        {
          bashOutput: {
            command: "cat test/gate.test.ts",
            output: "content",
            exitCode: 0,
          },
        },
      ],
    },
  ];

  const viewNonTest = buildSessionView(session, nonTestActivities);
  assert.equal(viewNonTest.report.testsPassed, undefined);

  // Now an actual test runner runs and passes
  const realTestActivities: JulesActivity[] = [
    ...nonTestActivities,
    {
      name: "act-2",
      createTime: "2026-10-19T10:00:02Z",
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

  const viewRealTest = buildSessionView(session, realTestActivities);
  assert.equal(viewRealTest.report.testsPassed, true);

  // Now a failing test command
  const failingTestActivities: JulesActivity[] = [
    ...realTestActivities,
    {
      name: "act-3",
      createTime: "2026-10-19T10:00:03Z",
      artifacts: [
        {
          bashOutput: {
            command: "pytest -v",
            output: "1 failed",
            exitCode: 1,
          },
        },
      ],
    },
  ];

  const viewFailingTest = buildSessionView(session, failingTestActivities);
  assert.equal(viewFailingTest.report.testsPassed, false);
});

test("session-view: maps state flags and needsYou accurately", () => {
  // Awaiting plan approval
  const planSession: JulesSession = {
    id: "s1",
    url: "https://jules.google.com/sessions/s1",
    state: "AWAITING_PLAN_APPROVAL",
  };
  const planView = buildSessionView(planSession, []);
  assert.equal(planView.needsYou, "Approve plan");

  // Awaiting user feedback
  const feedbackSession: JulesSession = {
    id: "s2",
    url: "https://jules.google.com/sessions/s2",
    state: "AWAITING_USER_FEEDBACK",
  };
  const feedbackActivities: JulesActivity[] = [
    {
      name: "act-fb",
      createTime: "2026-10-19T10:00:01Z",
      agentMessaged: { agentMessage: "Which database should I use?" },
    },
  ];
  const feedbackView = buildSessionView(feedbackSession, feedbackActivities);
  assert.equal(feedbackView.needsYou, "Which database should I use?");

  // Completed
  const completedSession: JulesSession = {
    id: "s3",
    url: "https://jules.google.com/sessions/s3",
    state: "COMPLETED",
    outputs: [
      {
        pullRequest: {
          url: "https://github.com/org/repo/pull/42",
          title: "PR #42",
          description: "Implemented feature cleanly",
        },
      },
    ],
  };
  const completedView = buildSessionView(completedSession, []);
  assert.equal(completedView.progress, 100);
  assert.equal(completedView.needsYou, null);
  assert.equal(completedView.report.prUrl, "https://github.com/org/repo/pull/42");
  assert.equal(completedView.report.summary, "Implemented feature cleanly");
});
