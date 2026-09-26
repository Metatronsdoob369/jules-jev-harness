import type { Session, Activity } from "./client.js";

export interface SessionView {
  id?: string;
  url?: string;
  state?: string;
  plan: string[];
  progress: number;
  lastStep?: {
    title?: string;
    description?: string;
  };
  report: {
    summary?: string;
    prUrl?: string;
    testsPassed?: boolean;
  };
  needsYou: string | null;
  newestActivityName?: string;
  capped?: boolean;
}

export function isTestRunnerCommand(cmd: string): boolean {
  if (!cmd) return false;
  const lower = cmd.trim().toLowerCase();

  // Must match one of the exact test suite runners:
  // - npm test and npm run test
  // - pnpm test and yarn test (including pnpm/yarn run test)
  // - node --test and tsx --test
  // - vitest, jest and pytest
  if (/\b(npm|pnpm|yarn)\s+(run\s+)?test\b/.test(lower)) return true;
  if (/\bnode\s+--test\b/.test(lower)) return true;
  if (/\btsx\s+--test\b/.test(lower)) return true;
  if (/\bvitest\b/.test(lower)) return true;
  if (/\bjest\b/.test(lower)) return true;
  if (/\bpytest\b/.test(lower)) return true;

  return false;
}

export function buildSessionView(session: Session, activities: Activity[] = [], capped: boolean = false): SessionView {
  // Sort activities by createTime ascending so newest is last
  const sortedActivities = [...activities].sort((a, b) => {
    const tA = a.createTime ? new Date(a.createTime).getTime() : 0;
    const tB = b.createTime ? new Date(b.createTime).getTime() : 0;
    return tA - tB;
  });

  // 1. Extract plan step titles
  let planSteps: string[] = [];
  for (const act of sortedActivities) {
    if (act.planGenerated?.plan?.steps) {
      planSteps = act.planGenerated.plan.steps
        .map((s) => s.title?.trim())
        .filter((t): t is string => Boolean(t));
    }
  }

  // 2. Progress calculation
  let progress = 0;
  if (session.state === "COMPLETED") {
    progress = 100;
  } else if (planSteps.length > 0) {
    const progressUpdates = sortedActivities.filter((a) => Boolean(a.progressUpdated));
    const count = progressUpdates.length;
    progress = Math.min(95, Math.round((count / planSteps.length) * 95));
  }

  // 3. Last step (newest progressUpdated title & description)
  let lastStep: { title?: string; description?: string } | undefined;
  for (let i = sortedActivities.length - 1; i >= 0; i--) {
    const act = sortedActivities[i];
    if (act?.progressUpdated) {
      lastStep = {
        title: act.progressUpdated.title,
        description: act.progressUpdated.description,
      };
      break;
    }
  }

  // 4. Report (PR url, summary, testsPassed)
  let prUrl: string | undefined;
  let prDescription: string | undefined;

  if (session.outputs) {
    for (const out of session.outputs) {
      if (out.pullRequest?.url) {
        prUrl = out.pullRequest.url;
      }
      if (out.pullRequest?.description) {
        prDescription = out.pullRequest.description;
      }
    }
  }

  let lastAgentMessage: string | undefined;
  for (let i = sortedActivities.length - 1; i >= 0; i--) {
    const msg = sortedActivities[i]?.agentMessaged?.agentMessage;
    if (msg) {
      lastAgentMessage = msg;
      break;
    }
  }

  const summary = prDescription || lastAgentMessage;

  // Newest test command bashOutput
  let testsPassed: boolean | undefined;
  for (let i = sortedActivities.length - 1; i >= 0; i--) {
    const artifacts = sortedActivities[i]?.artifacts;
    if (artifacts) {
      for (const art of artifacts) {
        if (art.bashOutput?.command) {
          if (isTestRunnerCommand(art.bashOutput.command)) {
            testsPassed = art.bashOutput.exitCode === 0;
            break;
          }
        }
      }
      if (testsPassed !== undefined) break;
    }
  }

  // 5. needsYou
  let needsYou: string | null = null;
  if (session.state === "AWAITING_PLAN_APPROVAL") {
    needsYou = "Awaiting plan approval";
  } else if (session.state === "AWAITING_USER_FEEDBACK") {
    needsYou = lastAgentMessage || "Awaiting user feedback";
  } else if (session.state === "FAILED") {
    let failureReason: string | undefined;
    for (let i = sortedActivities.length - 1; i >= 0; i--) {
      if (sortedActivities[i]?.sessionFailed?.reason) {
        failureReason = sortedActivities[i]?.sessionFailed?.reason;
        break;
      }
    }
    needsYou = failureReason || "Session failed";
  }

  // Newest activity name
  const newestActivityName = sortedActivities.length > 0 ? sortedActivities[sortedActivities.length - 1]?.name : undefined;

  return {
    id: session.id,
    url: session.url,
    state: session.state,
    plan: planSteps,
    progress,
    lastStep,
    report: {
      summary,
      prUrl,
      testsPassed,
    },
    needsYou,
    newestActivityName,
    capped,
  };
}
