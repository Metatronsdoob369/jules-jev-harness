/**
 * Pure state machine for Jules session polling ticks.
 * Decoupled from React and DOM for 100% deterministic testing.
 */

export function computeLiveStep({
  tile,
  sessionView,
  windowGateVerdict,
  doneGateVerdict,
  riskyGateVerdict,
}) {
  if (!tile || !sessionView) return { type: "noop" };

  const state = sessionView.state;
  const activityKey = sessionView.newestActivityName || "latest";

  // If Jules moved on without the board (e.g. user approved on the Jules page),
  // clear stale needsYou flags.
  if (tile.needsYou && state === "IN_PROGRESS" && !sessionView.needsYou) {
    return { type: "clear_needs_you" };
  }

  // ── State: FAILED ──────────────────────────────────────────────────────────
  if (state === "FAILED") {
    const askedKey = `FAILED:${activityKey}`;
    if (tile.askedFor === askedKey) return { type: "noop" };
    return {
      type: "flag",
      reason: sessionView.needsYou || "Session failed",
      askedFor: askedKey,
    };
  }

  // ── State: AWAITING_PLAN_APPROVAL ──────────────────────────────────────────
  if (state === "AWAITING_PLAN_APPROVAL") {
    const askedKey = `AWAITING_PLAN_APPROVAL:${activityKey}`;
    if (tile.askedFor === askedKey) return { type: "noop" };
    return {
      type: "ask_plan",
      question: `Approve plan for ${tile.id}?`,
      plan: sessionView.plan,
      askedFor: askedKey,
    };
  }

  // ── State: AWAITING_USER_FEEDBACK ──────────────────────────────────────────
  if (state === "AWAITING_USER_FEEDBACK") {
    const askedKey = `AWAITING_USER_FEEDBACK:${activityKey}`;
    if (tile.askedFor === askedKey) return { type: "noop" };
    return {
      type: "needs_feedback",
      message: sessionView.needsYou || "Jules requested feedback",
      askedFor: askedKey,
    };
  }

  // ── State: IN_PROGRESS (Window Gate Evaluation) ─────────────────────────────
  if (state === "IN_PROGRESS") {
    if (windowGateVerdict) {
      const stepTitle = sessionView.lastStep?.title || activityKey;
      const askedKey = `WINDOW_OPEN:${stepTitle}`;

      if (windowGateVerdict.action === "open") {
        if (tile.askedFor === askedKey) return { type: "noop" };
        return {
          type: "ask_window_open",
          question: `Review ${tile.id} in Jules now? (${sessionView.lastStep?.title || "Step"})`,
          sessionUrl: tile.sessionUrl,
          askedFor: askedKey,
        };
      }

      if (windowGateVerdict.action === "escalate" || windowGateVerdict.verdict === "escalate") {
        return {
          type: "flag",
          reason: windowGateVerdict.reason || "Window gate escalated",
        };
      }
    }

    return { type: "noop" };
  }

  // ── State: COMPLETED (Done & Risky Gate Sequencing) ─────────────────────────
  if (state === "COMPLETED") {
    const askedKey = `COMPLETED:${activityKey}`;
    if (tile.askedFor === askedKey) return { type: "noop" };

    // Step 1: Check Done Gate
    if (doneGateVerdict) {
      if (doneGateVerdict.action === "send_back") {
        return {
          type: "ask_send_back",
          question: `Ask Jules to finish: ${doneGateVerdict.reason || "missing items"}?`,
          missingItems: doneGateVerdict.reason,
          askedFor: askedKey,
        };
      }

      if (doneGateVerdict.action === "confirm" || doneGateVerdict.verdict === "confirm") {
        return {
          type: "ask_done",
          question: `Mark ${tile.id} done?`,
          askedFor: askedKey,
        };
      }

      if (
        doneGateVerdict.action === "escalate" ||
        doneGateVerdict.verdict === "escalate" ||
        doneGateVerdict.action !== "done"
      ) {
        return {
          type: "flag",
          reason: doneGateVerdict.reason || "Done gate check failed",
          askedFor: askedKey,
        };
      }
    }

    // Step 2: Done gate passed (act) -> Check Risky Gate
    if (riskyGateVerdict) {
      if (riskyGateVerdict.action === "run") {
        return {
          type: "ask_open_pr",
          question: `Open the pull request for ${tile.id}?`,
          prUrl: sessionView.report?.prUrl,
          askedFor: askedKey,
        };
      }

      // Risky block or escalate: Flag the tile, never open PR
      return {
        type: "flag",
        reason: riskyGateVerdict.reason || "Risky gate blocked merge",
        askedFor: askedKey,
      };
    }

    // If waiting on gates, keep as noop
    return { type: "noop" };
  }

  return { type: "noop" };
}
