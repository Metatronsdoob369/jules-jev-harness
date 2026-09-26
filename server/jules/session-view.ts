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
}

export function buildSessionView(session: Session, activities: Activity[] = []): SessionView {
  // 1. Extract plan step titles
  let planSteps: string[] = [];
  for (const act of activities) {
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
    // Count activities with progressUpdated
    const progressUpdates = activities.filter((a) => Boolean(a.progressUpdated));
    const count = progressUpdates.length;
    progress = Math.min(95, Math.round((count / planSteps.length) * 95));
  }

  // 3. Last step (newest progressUpdated title & description)
  let lastStep: { title?: string; description?: string } | undefined;
  for (let i = activities.length - 1; i >= 0; i--) {
    const act = activities[i];
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
  for (let i = activities.length - 1; i >= 0; i--) {
    const msg = activities[i]?.agentMessaged?.agentMessage;
    if (msg) {
      lastAgentMessage = msg;
      break;
    }
  }

  const summary = prDescription || lastAgentMessage;

  // Newest test command bashOutput
  let testsPassed: boolean | undefined;
  for (let i = activities.length - 1; i >= 0; i--) {
    const artifacts = activities[i]?.artifacts;
    if (artifacts) {
      for (const art of artifacts) {
        if (art.bashOutput?.command) {
          const cmd = art.bashOutput.command.toLowerCase();
          if (cmd.includes("test") || cmd.includes("check")) {
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
    for (let i = activities.length - 1; i >= 0; i--) {
      if (activities[i]?.sessionFailed?.reason) {
        failureReason = activities[i]?.sessionFailed?.reason;
        break;
      }
    }
    needsYou = failureReason || "Session failed";
  }

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
  };
}
