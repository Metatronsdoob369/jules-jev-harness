/**
 * The page's side of the jev-gates.
 *
 * The gates themselves run on the app's own server (server/jev), so the Jev key
 * never reaches this page. This file only asks for a verdict and reshapes it
 * for the board.
 */

/** Which mode the gates are in: 'live', 'stand-in', or 'offline'. */
export async function gateStatus() {
  try {
    const res = await fetch('/api/gate');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return { mode: 'offline', gates: [] };
  }
}

/**
 * Run one gate on one tile.
 * context = { tile, project, projects, atWindow?, lastStep?, pending?, report? }
 */
export async function executeGate(gate, context) {
  const started = performance.now();
  try {
    const res = await fetch(`/api/gate/${gate}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(context),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
    return {
      gate: body.gate,
      action: body.action,
      verdict: body.outcome, // act | confirm | escalate
      sureness: body.confidence,
      source: body.source, // rule | jev | fallback
      reason: body.why,
      details: body.details,
      ms: body.ms,
      tokens: body.tokens ?? 0,
      model: body.model,
      mode: body.mode, // live | stand-in
    };
  } catch (err) {
    // No gate server: fail safe, so a person decides.
    return {
      gate,
      action: 'none',
      verdict: 'escalate',
      sureness: 0,
      source: 'fallback',
      reason: `Gate server unreachable (${err.message})`,
      ms: Math.round(performance.now() - started),
      tokens: 0,
      mode: 'offline',
    };
  }
}
