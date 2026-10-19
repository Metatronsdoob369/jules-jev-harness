# Enforceable PDR: Live Jules Agent Integration & Hardened Harness

**Target Repository:** `/Users/joewales/jules-jev-harness`  
**Target Branch:** `fix/live-jules` (from `main`)  
**Status:** DRAFT (Awaiting Approval)  
**Standard:** FRE 902 / Context-Engineering Compliant / Deterministic Verification Gates

---

## 1. Goal Description

Transform `jules-jev-harness` from a simulated-agent demonstration into a production-hardened, real-world execution harness that safely drives Google Jules coding sessions via the Jules REST API (`https://jules.googleapis.com/v1alpha/`), guarded by TypeSafe's Jev decision gates (`intake`, `route`, `window`, `risky`, `done`).

The implementation resolves all 9 security, state-machine, and synchronization hazards outlined in the hardening brief, guaranteeing:
1. **Zero Secret Leakage:** `JULES_API_KEY` resides strictly in the Node/Vite backend; verified by build-time bundle scanning.
2. **DNS Rebinding & CSRF Immunity:** Strict `Host`, `Origin`, and `Content-Type` validation on all `/api/gate` and `/api/jules` endpoints.
3. **Deterministic Human-in-the-Loop:** Every dispatch, plan modification, and PR open requires affirmative human consent; automated self-merges are strictly prohibited.
4. **Resilient Polling & State Management:** Debounced 10-second polling decoupled from tile drag/render events, with pagination up to 20 activity pages and deduplicated question prompts.

---

## 2. User Review Required

> [!IMPORTANT]
> **No External API Calls During Tests**: All automated test suites will run strictly against `mock-jules.ts` and `mock-jev.ts`. No external traffic or billable API calls will occur during verification.

> [!WARNING]
> **Git Branch Discipline**: All changes will be developed on branch `fix/live-jules`. `main` will remain untouched until an explicit PR is reviewed and merged.

> [!NOTE]
> **Graceful Degradation**: If `JULES_API_KEY` is not defined in `.env`, the harness operates cleanly in simulated mode without breaking existing workflows.

---

## 3. Architecture & Data Flow

```mermaid
graph TD
    subgraph Browser Client [Vite / React Frontend]
        Canvas[3D/2D Kanban Canvas]
        Hub[OrchestrationHub.jsx]
        LiveStep[live-step.js: Pure State Machine]
        Drawer[SpecTelemetryDrawer.jsx + ReplyBox]
    end

    subgraph Server Boundary [server/jev-plugin.ts]
        Guard[Security Guard: Host / Origin / Content-Type / Loopback]
        GateRoutes[/api/gate/:name]
        JulesRoutes[/api/jules/*]
    end

    subgraph Decision Engine [server/jev/]
        JevGates[gates.ts: intake, route, window, risky, done]
        JevRunner[gate.ts: 6-part block]
    end

    subgraph Execution Engine [server/jules/]
        Client[client.ts: fetch wrapper + timeout]
        SessionView[session-view.ts: Activity sort + PR/Test extraction]
        MockJules[mock-jules.ts: wire-format stand-in]
    end

    subgraph External [Google Jules API]
        JulesAPI[https://jules.googleapis.com/v1alpha/]
    end

    Hub -->|Poll 10s| JulesRoutes
    Hub -->|Evaluate| GateRoutes
    LiveStep -->|Decide next action| Hub
    Drawer -->|POST Message / Plan| JulesRoutes

    ServerBoundary --> Guard
    Guard --> GateRoutes
    Guard --> JulesRoutes

    GateRoutes --> JevRunner
    JulesRoutes --> Client
    Client -->|Live Mode| JulesAPI
    Client -.->|Test Mode| MockJules
```

---

## 4. Proposed Changes

### Component 1: Server Security & Route Hardening (`server/`)

#### `[MODIFY]` `server/jev-plugin.ts`
Enforces strict security middleware for both `/api/gate` and `/api/jules`:
- **Host Header Validation:** Reject with 403 if `Host` hostname is not `localhost`, `127.0.0.1`, or `[::1]`, unless `JEV_ALLOW_LAN=1`.
- **Origin Validation:** Reject with 403 if `Origin` header is present and does not match the server's own origin (`http://` + `Host`).
- **Content-Type Enforcement:** Require `application/json` on all POST requests (including `/api/jules/:id/approve` and `:id/message`).
- **Input Sanitization:** Validate session IDs against `^[A-Za-z0-9_-]{1,64}$`. Validate repository names against `^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`.
- **Jules Endpoints Mounting:**
  - `GET /api/jules`: Returns `{ mode: "live" | "simulated", repos: [...] }`. When live, calls `listSources` (paginated up to exhaustion) to extract connected `owner/repo` names.
  - `POST /api/jules/dispatch`: Validates `{ tile, project }`, rejects placeholder/missing repos, appends mandatory safety directive (`"Don't deploy anything, and don't use MCP tools such as Render or Stitch."`), calls `createSession`, returns `{ sessionId, url }`.
  - `GET /api/jules/:id`: Fetches session and all activity pages (up to 20 pages max), sorts chronologically, and returns the unified `sessionView`.
  - `POST /api/jules/:id/approve`: Calls Jules `approvePlan`.
  - `POST /api/jules/:id/message`: Calls Jules `sendMessage` with `{ prompt }`.

---

### Component 2: Jules API Integration Core (`server/jules/`)

#### `[NEW]` `server/jules/client.ts`
- Clean `fetch` wrapper communicating with `https://jules.googleapis.com/v1alpha/`.
- Authenticates using header `X-Goog-Api-Key: <JULES_API_KEY>`.
- Configurable timeout (10s default) with graceful aborts.
- Clear error handling mapping HTTP 404 on `sources` to `"repo not connected to Jules (install the Jules GitHub app on it)"` and on `sessions` to `"Jules session not found"`.
- Implements:
  - `listSources(pageToken?)`
  - `createSession(prompt, title, source, branch)`
  - `getSession(id)`
  - `listActivities(id, pageToken?)`
  - `approvePlan(id)`
  - `sendMessage(id, prompt)`

#### `[NEW]` `server/jules/session-view.ts`
- Converts raw Jules session and activity log into normalized frontend telemetry:
  - **Activity Sorting:** Sorts all activities ascending by `createTime` so evaluation is deterministic regardless of API page delivery order.
  - **Pagination Safety:** Loops `nextPageToken` up to a hard safety cap of 20 pages. If capped, sets `activitiesCapped: true`.
  - **Plan Extraction:** Extracts step titles from `planGenerated.plan.steps[]`.
  - **Progress Computation:** Computes 0–95% proportional to completed plan steps, locking to 100% only upon `COMPLETED`.
  - **Last Step Details:** Extracts newest `progressUpdated` title and description.
  - **Report & PR Summary:** Pulls PR description (fallback to last agent message), PR URL (`outputs[].pullRequest.url`), and test status.
  - **Strict Test Command Filter:** Sets `testsPassed: true` only if the latest test command exit code is 0 AND the command matches actual test runners (`npm test`, `npm run test`, `pnpm test`, `yarn test`, `node --test`, `tsx --test`, `vitest`, `jest`, `pytest`). Arbitrary checks (`cat`, `git checkout`, `npm run typecheck`) do not satisfy `testsPassed`.
  - **Action Flags (`needsYou`):** Populates when `AWAITING_PLAN_APPROVAL`, `AWAITING_USER_FEEDBACK` (with last agent message), or `FAILED` (with failure reason).

#### `[NEW]` `server/jules/mock-jules.ts`
- Stand-in mock implementing the full Jules wire format for deterministic in-memory testing.
- Simulates multi-page activity streams, failure modes, plan generation, and PR emission.

---

### Component 3: Frontend State Machine & Polling Hardening (`src/`)

#### `[NEW]` `src/jules/live-step.js`
- Pure, headless state transition function extracted from React components for 100% automated test coverage.
- Evaluates the current tile state, session view, and gate verdicts to produce deterministic transitions:
  - **Question Deduping:** Stores `askedFor: "<state>:<activityName>"`; asks at most once per state transition.
  - **NO Handling:** When a user clicks NO to a question, leaves the tile flagged with `needsYou` and suppresses repeated popups.
  - **Window Gate Handling:** When a progress checkpoint triggers the window gate with `open`, requests confirmation: *"Review TSK-x in Jules now? (<step>)"*. On YES, calls `window.open` within the user event context. On `escalate`, flags the tile. On `keep_going`, does nothing.
  - **Done & Risky Gate Sequencing:**
    - `done, act`: Automatically triggers the `risky` gate.
    - `done, confirm`: Asks *"Mark TSK-x done?"*. On YES, runs `risky` gate.
    - `done, send_back`: Asks *"Ask Jules to finish: <missing items>?"*. On YES, sends prompt via message API.
    - `done, escalate`: Flags tile with reason.
    - `risky, run`: Requires confirmation: *"Open the pull request for TSK-x?"*. On YES, opens PR URL and transitions to `REVIEW`.
    - `risky, block`: Flags tile with explanation; never opens the PR.

#### `[MODIFY]` `src/components/OrchestrationHub.jsx`
- **Decoupled Polling Loop:**
  - Moves active tasks into a `useRef` to prevent timer teardown and reset whenever unrelated tiles advance.
  - Implements a tick mutex: skips polling tick if a previous poll request is still in flight.
  - Automatically ceases polling when a task reaches `FAILED` or when `COMPLETED` handling has finalized.
  - Tracks consecutive network errors: surfaces an alert on the tile after 2 consecutive poll failures.
- **Human Approval Modal:**
  - Displays exactly one actionable modal at a time.
  - For Jules tiles, renders acceptance criteria checkboxes as unticked, reserving completion judgment strictly for the `done` gate.

#### `[MODIFY]` `src/components/SpecTelemetryDrawer.jsx`
- Adds bidirectional interactive reply box for Jules sessions:
  - Active when `needsYou` is set due to `AWAITING_USER_FEEDBACK` or when the user rejected a plan (`Plan NO`).
  - Textarea with "Send to Jules" action invoking `POST /api/jules/:id/message`.
  - Displays session link with external navigation.
  - Suppresses legacy default banner text (*"Move the tile with Stage Control"*).

---

### Component 4: Project Configuration & Test Harness (`package.json`, `.env.example`, `README.md`)

#### `[MODIFY]` `package.json`
- Update test runner script to execute both Jev and Jules test suites:
  ```json
  "scripts": {
    "test": "tsx --test server/**/*.test.ts src/**/*.test.js",
    "typecheck": "tsc -p tsconfig.server.json"
  }
  ```

#### `[MODIFY]` `.env.example`
- Add `JULES_API_KEY=` line.

#### `[MODIFY]` `README.md`
- Update "What's real" table:
  - *Agents row:* `"Real with JULES_API_KEY; simulated without it"`.

---

## 5. Verification Plan

### Automated Test Suite (`npm test`)

| Test File | Verification Target |
| :--- | :--- |
| `server/jev/*.test.ts` | The original 18 checks continue to pass without regression. |
| `server/jules/client.test.ts` | Jules API client: timeout handling, 404 message mapping, payload construction, header validation. |
| `server/jules/session-view.test.ts` | Activity pagination up to 20 pages, chronological sorting, strict test runner detection (`npm test` vs `cat`), PR extraction. |
| `server/jules/routes.test.ts` | Security guards: Host header reject (403), Origin header reject (403), JSON enforcement (415), session ID regex (400), zero key leakage in responses. |
| `src/jules/live-step.test.js` | Pure decision function: Single prompt per state, window gate user confirmation, risky gate block enforcement, send_back prompt generation. |

### Build & Bundle Verification
1. `npm run typecheck` passes with zero TypeScript errors.
2. `npm run build` generates production bundle in `dist/`.
3. Security check:
   ```bash
   grep -r "JULES_API_KEY\|jules.googleapis.com" dist/
   ```
   **Pass Criteria:** Exit code 1 (zero matches in frontend bundle).

### Manual Verification Flow
1. Start dev server with `npm run dev`.
2. Inspect `GET /api/jules` via curl with a foreign `Host: attacker.com` $\rightarrow$ verify HTTP 403.
3. Verify Kanban board loads and shows simulated mode without `JULES_API_KEY`.
4. Select task, verify drawer renders and respects unjudged / judged states cleanly.
