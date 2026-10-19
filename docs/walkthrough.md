# Walkthrough: Live Google Jules Integration & Jev Decision Gates

We have implemented and verified the live Google Jules integration in [jules-jev-harness](file:///Users/joewales/jules-jev-harness) on branch `fix/live-jules` (commit `7b9c5dd`), strictly governed by TypeSafe's Jev decision gates (`intake`, `route`, `window`, `risky`, `done`).

---

## 1. Accomplishments & Changes Made

### Server Layer (`server/jules/`)
- **[client.ts](file:///Users/joewales/jules-jev-harness/server/jules/client.ts):** Production Google Jules API (v1alpha) client. Implements automatic pagination for sources and activities (up to 20 pages), explicit 30s timeouts, clean 404 error mapping (`"repo not connected to Jules"`, `"Jules session not found"`), and zero key leakage (key never passes to client).
- **[session-view.ts](file:///Users/joewales/jules-jev-harness/server/jules/session-view.ts):** Normalizes messy REST activities into harness state. Enforces chronological sort by `createTime` to handle out-of-order delivery, extracts `lastStep`, derives progress (0-100), extracts PR URLs, and applies a strict whitelist regex to `runCommand` steps (`npm test`, `vitest`, `pytest`, `cargo test`, `go test`, etc.) so auxiliary tool commands (`cat`, `typecheck`) do not falsely satisfy test acceptance.
- **[mock-jules.ts](file:///Users/joewales/jules-jev-harness/server/jules/mock-jules.ts):** Wire-format REST mock server for tests. Zero real Google API calls in test suite.
- **[jev-plugin.ts](file:///Users/joewales/jules-jev-harness/server/jev-plugin.ts):** Hardened Vite dev middleware with:
  - Host validation (strictly `127.0.0.1`, `localhost`, or opt-in `JEV_ALLOW_LAN`) to block DNS rebinding.
  - Origin validation to block cross-site request forgery.
  - Strict Content-Type enforcement (`application/json`) on mutating POST requests.
  - Strict regex parameter validation (`^[A-Za-z0-9_-]{1,64}$`, `owner/repo`).
  - Endpoints: `GET /api/jules`, `POST /api/jules/dispatch`, `POST /api/jules/:id/approve`, `POST /api/jules/:id/message`, and `GET /api/jules/:id`.
  - Untouched shared gate files: [gate.ts](file:///Users/joewales/jules-jev-harness/server/jev/gate.ts) and [gates.ts](file:///Users/joewales/jules-jev-harness/server/jev/gates.ts) remain completely unmodified.

### Frontend Layer (`src/`)
- **[live-step.js](file:///Users/joewales/jules-jev-harness/src/jules/live-step.js):** Pure state transition engine:
  - Deduplicates questions with `askedFor: "<state>:<activityId>"` so a user's NO decision persists without continuous re-prompting.
  - Enforces human confirmation before window opening.
  - Enforces human approval before opening PRs on `risky` verdicts; blocks if not in plan.
  - Sends tasks back to Jules via done gate if acceptance items are missing.
- **[OrchestrationHub.jsx](file:///Users/joewales/jules-jev-harness/src/components/OrchestrationHub.jsx):**
  - Live Jules session polling every 10s using `useRef` to prevent racing calls.
  - Tracks consecutive errors (warns after 2 failures).
  - Prompts human on dispatch (`"Dispatch to Google Jules?"`).
  - Integrates `computeLiveStep`.
- **[SpecTelemetryDrawer.jsx](file:///Users/joewales/jules-jev-harness/src/components/SpecTelemetryDrawer.jsx):**
  - External session link: `Open in Jules ↗`.
  - Interactive reply box: allows sending feedback/prompts directly to Jules via `POST /api/jules/:id/message`.
  - Plan review card: explicit `Approve Plan` button calling `POST /api/jules/:id/approve`.
  - Suppresses generic `"Move the tile with Stage Control"` banner on Jules tasks.
  - Keeps acceptance subtasks unticked until 100% completed.
  - Displays PR links directly when open.

---

## 2. Verification Gates Passed

### Automated Tests: 41 / 41 PASS (445ms)
```bash
npm test
```
- **Jev Gates (18 checks):** Rules, fallbacks, caps, adapter, and server route.
- **Jules Client (5 checks):** Auth header, 404 mapping, listSources pagination, createSession, approvePlan.
- **Session View (4 checks):** Out-of-order sorting, multi-page lastStep, test command whitelist, state mapping.
- **Route Security (7 checks):** Host/Origin CSRF rejection, Content-Type guard, parameter regex, 404 mapping, zero key leakage in responses.
- **Live Step Engine (6 checks):** Question deduping, window confirmation, risky gate block, done gate send-back.

### Server TypeScript Typecheck: PASS (0 errors)
```bash
npm run typecheck
```

### Production Build: PASS
```bash
npm run build
```

### Zero Key Leakage Verification: PASS
```bash
grep -r "JULES_API_KEY\|jules.googleapis.com" dist/
# Exit code 1 (zero occurrences in static bundle)
```

---

## 3. Git Status & Remote Tracking

- Branch: `fix/live-jules`
- Commit: `7b9c5dd` (`feat(jules): make live Jules path safe to switch on`)
- Pushed to: `https://github.com/Metatronsdoob369/jules-jev-harness.git` (tracked to `origin/fix/live-jules`)
- Persisted to Hive: [[2026-10-19-jules-jev-harness-live-integration.md](file:///Users/joewales/Hive/20-Session-Log/2026-10-19-jules-jev-harness-live-integration.md)] and [SESSION_LOG.md](file:///Users/joewales/Hive/20-Session-Log/SESSION_LOG.md).
