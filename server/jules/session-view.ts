import type { JulesActivity, JulesSession } from "./client.js";

export interface SessionView {
  id: string;
  state: JulesSession["state"];
  plan: string[];
  progress: number;
  lastStep: { title: string; description?: string } | null;
  report: {
    summary?: string;
    prUrl?: string;
    testsPassed?: boolean;
  };
  needsYou: string | null;
  newestActivityName: string | null;
  activitiesCapped?: boolean;
}

const TEST_COMMAND_REGEX =
  /\b(npm\s+(run\s+)?test|pnpm\s+test|yarn\s+test|node\s+--test|tsx\s+--test|vitest|jest|pytest)\b/;

/**
 * Normalizes a Jules session and its raw activity stream into the exact
 * telemetry shape expected by Jev gates and the frontend board.
 */
export function buildSessionView(
  session: JulesSession,
  rawActivities: JulesActivity[] = [],
  options: { capped?: boolean } = {}
): SessionView {
  // Sort activities ascending by createTime so evaluation is deterministic
  const activities = [...rawActivities].sort((a, b) => {
    if (!a.createTime || !b.createTime) return 0;
    return new Date(a.createTime).getTime() - new Date(b.createTime).getTime();
  });

  // Extract Plan
  let plan: string[] = [];
  for (let i = activities.length - 1; i >= 0; i--) {
    const act = activities[i]!;
    if (act.planGenerated?.plan?.steps && Array.isArray(act.planGenerated.plan.steps)) {
      plan = act.planGenerated.plan.steps.map((s) => s.title);
      break;
    }
  }

  // Extract Last Step (newest progressUpdated)
  let lastStep: { title: string; description?: string } | null = null;
  let lastStepIndex = 0;
  for (let i = activities.length - 1; i >= 0; i--) {
    const act = activities[i]!;
    if (act.progressUpdated) {
      lastStep = {
        title: act.progressUpdated.title,
        description: act.progressUpdated.description,
      };
      if (plan.length > 0) {
        const found = plan.findIndex((p) => p.trim() === act.progressUpdated?.title.trim());
        if (found >= 0) {
          lastStepIndex = found + 1;
        }
      }
      break;
    }
  }

  // Calculate Progress (0 - 100)
  let progress = 0;
  if (session.state === "COMPLETED") {
    progress = 100;
  } else if (session.state === "FAILED") {
    progress = 0;
  } else if (session.state === "QUEUED") {
    progress = 0;
  } else if (session.state === "PLANNING") {
    progress = 5;
  } else if (session.state === "AWAITING_PLAN_APPROVAL") {
    progress = 10;
  } else if (session.state === "IN_PROGRESS" || session.state === "AWAITING_USER_FEEDBACK" || session.state === "PAUSED") {
    if (plan.length > 0 && lastStepIndex > 0) {
      progress = Math.min(95, Math.max(10, Math.round((lastStepIndex / plan.length) * 95)));
    } else {
      progress = 25;
    }
  }

  // Extract Pull Request info
  let prUrl: string | undefined = undefined;
  let prTitle: string | undefined = undefined;
  let prDescription: string | undefined = undefined;
  if (Array.isArray(session.outputs)) {
    for (const out of session.outputs) {
      if (out.pullRequest?.url) {
        prUrl = out.pullRequest.url;
        prTitle = out.pullRequest.title;
        prDescription = out.pullRequest.description;
        break;
      }
    }
  }

  // Extract Summary (PR description falling back to last agent message)
  let summary = prDescription || prTitle;
  if (!summary) {
    for (let i = activities.length - 1; i >= 0; i--) {
      const act = activities[i]!;
      if (act.agentMessaged?.agentMessage) {
        summary = act.agentMessaged.agentMessage;
        break;
      }
    }
  }

  // Extract testsPassed (strictly whitelisted test runners only)
  let testsPassed: boolean | undefined = undefined;
  for (let i = activities.length - 1; i >= 0; i--) {
    const act = activities[i]!;
    if (Array.isArray(act.artifacts)) {
      for (const artifact of act.artifacts) {
        if (artifact.bashOutput) {
          const cmd = artifact.bashOutput.command.trim();
          if (TEST_COMMAND_REGEX.test(cmd)) {
            testsPassed = artifact.bashOutput.exitCode === 0;
            break;
          }
        }
      }
      if (testsPassed !== undefined) break;
    }
  }

  // Determine needsYou
  let needsYou: string | null = null;
  if (session.state === "AWAITING_PLAN_APPROVAL") {
    needsYou = "Approve plan";
  } else if (session.state === "AWAITING_USER_FEEDBACK") {
    let lastAgentMsg = "";
    for (let i = activities.length - 1; i >= 0; i--) {
      if (activities[i]?.agentMessaged?.agentMessage) {
        lastAgentMsg = activities[i]!.agentMessaged!.agentMessage;
        break;
      }
    }
    needsYou = lastAgentMsg || "Awaiting user feedback";
  } else if (session.state === "FAILED") {
    let failReason = "";
    for (let i = activities.length - 1; i >= 0; i--) {
      if (activities[i]?.sessionFailed?.reason) {
        failReason = activities[i]!.sessionFailed!.reason;
        break;
      }
    }
    needsYou = failReason || "Session failed";
  }

  // Newest activity name (for question deduplication)
  const newestActivity = activities.length > 0 ? activities[activities.length - 1] : null;
  const newestActivityName = newestActivity?.name || null;

  return {
    id: session.id,
    state: session.state,
    plan,
    progress,
    lastStep,
    report: {
      summary,
      prUrl,
      testsPassed,
    },
    needsYou,
    newestActivityName,
    activitiesCapped: options.capped,
  };
}
