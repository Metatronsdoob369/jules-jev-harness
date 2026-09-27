/**
 * Pure decision function for per-poll evaluation of a live Jules session tile.
 * Evaluates sessionView against tile state and returns patched tile properties
 * and any new question modal action to present to the user.
 */

export interface LiveStepTile {
  id: string;
  column?: string;
  needsYou?: string | null;
  askedFor?: string;
  handledCompleted?: boolean;
  sessionId?: string;
  sessionUrl?: string;
}

export interface SessionView {
  id?: string;
  url?: string;
  state?: string;
  plan?: string[];
  progress?: number;
  lastStep?: {
    title?: string;
    description?: string;
  };
  report?: {
    summary?: string;
    prUrl?: string;
    testsPassed?: boolean;
  };
  needsYou?: string | null;
  newestActivityName?: string;
  capped?: boolean;
}

export type GateRunner = (
  name: string,
  extra?: Record<string, unknown>
) => Promise<any>;

export async function evalLiveStep(
  tile: LiveStepTile,
  sessionView: SessionView,
  runGate?: GateRunner
): Promise<{ patch: Record<string, any>; question: any }> {
  const patch: Record<string, any> = {};
  let question: any = null;

  if (!sessionView || !sessionView.state) {
    return { patch, question };
  }

  const newestAct = sessionView.newestActivityName || '';
  const stateKey = `${sessionView.state}:${newestAct}`;

  // Always sync progress, plan, lastStep, report
  patch.progress = sessionView.progress;
  if (sessionView.plan) patch.plan = sessionView.plan;
  if (sessionView.lastStep) patch.lastStep = sessionView.lastStep;
  if (sessionView.report) patch.report = sessionView.report;

  // Clear stale needsYou when session leaves AWAITING_PLAN_APPROVAL or AWAITING_USER_FEEDBACK
  if ((sessionView.state === 'IN_PROGRESS' || sessionView.state === 'COMPLETED') && tile.needsYou) {
    if (!sessionView.needsYou) {
      patch.needsYou = null;
    }
  }

  // 1. FAILED
  if (sessionView.state === 'FAILED') {
    if (tile.askedFor !== stateKey) {
      patch.askedFor = stateKey;
      patch.needsYou = sessionView.needsYou || 'Session failed';
      patch.handledCompleted = true;
    }
    return { patch, question };
  }

  // 2. AWAITING_PLAN_APPROVAL
  if (sessionView.state === 'AWAITING_PLAN_APPROVAL') {
    if (tile.askedFor !== stateKey) {
      patch.needsYou = 'Awaiting plan approval';
      question = {
        tile,
        text: `Approve Jules plan for ${tile.id}?`,
        kind: 'jules_plan',
        sessionId: sessionView.id,
        stateKey,
      };
    }
    return { patch, question };
  }

  // 3. AWAITING_USER_FEEDBACK
  if (sessionView.state === 'AWAITING_USER_FEEDBACK') {
    if (tile.askedFor !== stateKey) {
      patch.askedFor = stateKey;
      patch.needsYou = sessionView.needsYou || 'Awaiting user feedback';
    }
    return { patch, question };
  }

  // 4. IN_PROGRESS - Check window gate on progress update if runGate provided
  if (sessionView.state === 'IN_PROGRESS' && sessionView.lastStep) {
    const stepKey = `window:${sessionView.lastStep.title}:${sessionView.lastStep.description}`;
    if (tile.askedFor !== stepKey) {
      if (runGate) {
        try {
          const lastStepStr = `${sessionView.lastStep.title || ''}: ${sessionView.lastStep.description || ''}`;
          const verdict = await runGate('window', {
            tile,
            atWindow: true,
            lastStep: lastStepStr,
          });

          if (verdict.action === 'open') {
            const stepTitle = sessionView.lastStep.title || 'current step';
            question = {
              tile,
              text: `Review ${tile.id} in Jules now? (${stepTitle})`,
              kind: 'jules_window_open',
              url: sessionView.url || tile.sessionUrl,
              stateKey: stepKey,
            };
          } else if (verdict.verdict === 'escalate') {
            patch.askedFor = stepKey;
            patch.needsYou = verdict.reason || 'Window gate escalated';
          } else {
            // keep_going or other non-asking verdict
            patch.askedFor = stepKey;
          }
        } catch (err) {
          // Gate evaluation error
        }
      }
    }
    return { patch, question };
  }

  // 5. COMPLETED - Run done gate and risky gate
  if (sessionView.state === 'COMPLETED' && !tile.handledCompleted && tile.askedFor !== stateKey) {
    if (runGate) {
      try {
        const doneVerdict = await runGate('done', {
          tile,
          report: sessionView.report,
        });

        if (doneVerdict.action === 'send_back') {
          const missingStr = doneVerdict.reason || 'Missing items';
          question = {
            tile,
            text: `Ask Jules to finish: ${missingStr}?`,
            kind: 'jules_done_retry',
            missingItems: missingStr,
            sessionId: sessionView.id,
            stateKey,
          };
          return { patch, question };
        } else if (doneVerdict.verdict === 'escalate') {
          patch.askedFor = stateKey;
          patch.needsYou = doneVerdict.reason || 'Done gate escalated';
          patch.handledCompleted = true;
          return { patch, question };
        } else if (doneVerdict.action === 'done') {
          if (doneVerdict.verdict === 'confirm') {
            question = {
              tile,
              text: `Mark ${tile.id} done?`,
              kind: 'jules_done_confirm',
              sessionId: sessionView.id,
              report: sessionView.report,
              stateKey,
            };
            return { patch, question };
          } else if (doneVerdict.verdict === 'act') {
            return await evalRiskyGate(tile, sessionView, runGate, stateKey, patch);
          } else {
            patch.askedFor = stateKey;
            patch.needsYou = doneVerdict.reason || `Done gate verdict: ${doneVerdict.verdict}`;
            patch.handledCompleted = true;
            return { patch, question };
          }
        } else {
          patch.askedFor = stateKey;
          patch.needsYou = doneVerdict.reason || `Unexpected done gate action: ${doneVerdict.action}`;
          patch.handledCompleted = true;
          return { patch, question };
        }
      } catch (err) {
        // Error running done gate
      }
    }
  }

  return { patch, question };
}

export async function evalRiskyGate(
  tile: LiveStepTile,
  sessionView: SessionView,
  runGate: GateRunner,
  stateKey: string,
  existingPatch: Record<string, any> = {}
): Promise<{ patch: Record<string, any>; question: any }> {
  const patch = { ...existingPatch };
  let question: any = null;

  try {
    const riskyVerdict = await runGate('risky', {
      tile,
      report: sessionView.report,
      pending: { kind: 'merge', detail: `Merge ${sessionView.report?.prUrl || ''}` },
    });

    if (riskyVerdict.action === 'run') {
      const prUrl = sessionView.report?.prUrl || tile.sessionUrl;
      question = {
        tile,
        text: `Open the pull request for ${tile.id}?`,
        kind: 'jules_pr',
        prUrl,
        stateKey,
      };
    } else if (riskyVerdict.action === 'block' || riskyVerdict.verdict === 'escalate') {
      patch.askedFor = stateKey;
      patch.needsYou = riskyVerdict.reason || `Risky gate ${riskyVerdict.action}ed`;
      patch.handledCompleted = true;
    } else {
      patch.askedFor = stateKey;
      patch.needsYou = riskyVerdict.reason || `Risky gate unexpected action: ${riskyVerdict.action}`;
      patch.handledCompleted = true;
    }
  } catch (err) {
    // Error running risky gate
  }

  return { patch, question };
}
