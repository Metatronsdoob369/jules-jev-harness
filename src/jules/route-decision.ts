export interface RouteVerdict {
  action: string;
  verdict: string;
  reason: string;
}

export interface RouteTile {
  id: string;
  projectId?: string;
}

export interface RouteProject {
  repo?: string;
}

export interface RouteDecisionResult {
  action: 'hold' | 'dispatch_jules' | 'start_simulated_jules' | 'start_simulated_writer';
  question?: {
    text: string;
    kind: string;
  } | null;
  patch?: Record<string, any>;
}

export function evalRouteDecision(
  verdict: RouteVerdict,
  julesMode: 'live' | 'simulated',
  tile: RouteTile,
  project?: RouteProject | null
): RouteDecisionResult {
  const action = verdict.action;

  // 1. hold, person, split -> never start anything, flag tile with reason
  if (action === 'hold' || action === 'person' || action === 'split') {
    return {
      action: 'hold',
      patch: { needsYou: verdict.reason || `Route action ${action}` },
    };
  }

  // 2. jules
  if (action === 'jules') {
    if (julesMode === 'live') {
      const repoStr = (project?.repo ?? '').trim();
      if (!repoStr || repoStr === 'your-org/harness') {
        return {
          action: 'hold',
          patch: { needsYou: "Set this project's repo in src/data/initialData.js." },
        };
      }
      // Live mode always asks "Start a Jules session for TSK-x?", even on 'act', never starts simulated
      return {
        action: 'dispatch_jules',
        question: {
          text: `Start a Jules session for ${tile.id}?`,
          kind: 'dispatch_jules',
        },
      };
    } else {
      // Simulated mode
      if (verdict.verdict === 'act') {
        return { action: 'start_simulated_jules' };
      } else if (verdict.verdict === 'confirm') {
        return {
          action: 'start_simulated_jules',
          question: {
            text: `Send ${tile.id} to Jules (Simulated)?`,
            kind: 'start_simulated_jules',
          },
        };
      } else {
        return {
          action: 'hold',
          patch: { needsYou: verdict.reason || 'Routing escalated' },
        };
      }
    }
  }

  // 3. writer
  if (action === 'writer') {
    if (verdict.verdict === 'act') {
      return { action: 'start_simulated_writer' };
    } else if (verdict.verdict === 'confirm') {
      return {
        action: 'start_simulated_writer',
        question: {
          text: `Send ${tile.id} to Writer model (Simulated)?`,
          kind: 'start_simulated_writer',
        },
      };
    } else {
      return {
        action: 'hold',
        patch: { needsYou: verdict.reason || 'Routing escalated' },
      };
    }
  }

  // Fallback for unexpected actions
  return {
    action: 'hold',
    patch: { needsYou: verdict.reason || `Route action ${action}` },
  };
}
