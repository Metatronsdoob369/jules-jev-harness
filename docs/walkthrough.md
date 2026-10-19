# Walkthrough: Live Google Jules Integration, 5-D Spectral Radar & Graph Discovery Engine

We have implemented and verified the live Google Jules integration, **Beat 2: Spectral Terrain 5-D Geometric Radar**, and **Beat 3: Autonomous Multi-Variable Data Discovery Engine (BigQuery Property Graph ISO GQL standard)** in [jules-jev-harness](file:///Users/joewales/jules-jev-harness) on branch `main`, strictly governed by TypeSafe's Jev decision gates (`intake`, `route`, `window`, `risky`, `done`).

---

## 1. Accomplishments & Changes Made

### Server Layer (`server/jules/`, `server/spectral/`, & `server/discovery/`)
- **[client.ts](file:///Users/joewales/jules-jev-harness/server/jules/client.ts):** Production Google Jules API (v1alpha) client. Implements automatic pagination for sources and activities (up to 20 pages), explicit 30s timeouts, clean 404 error mapping (`"repo not connected to Jules"`, `"Jules session not found"`), and zero key leakage (key never passes to client).
- **[session-view.ts](file:///Users/joewales/jules-jev-harness/server/jules/session-view.ts):** Normalizes messy REST activities into harness state. Enforces chronological sort by `createTime` to handle out-of-order delivery, extracts `lastStep`, derives progress (0-100), extracts PR URLs, and applies a strict whitelist regex to `runCommand` steps (`npm test`, `vitest`, `pytest`, `cargo test`, `go test`, etc.) so auxiliary tool commands (`cat`, `typecheck`) do not falsely satisfy test acceptance.
- **[mock-jules.ts](file:///Users/joewales/jules-jev-harness/server/jules/mock-jules.ts):** Wire-format REST mock server for tests. Zero real Google API calls in test suite.
- **[fingerprint.ts](file:///Users/joewales/jules-jev-harness/server/spectral/fingerprint.ts) (Beat 2):** Pure mathematical implementation of Spectral Terrain's 5-D geometric vector:
  - $d_1 = \ln(1 + \text{chars})$, $d_2 = (\text{abs}(\text{imul}(31, \text{hash})) \pmod{1000}) / 1000$, $d_3 = \ln(1 + \text{lines})$, $d_4 = \ln(1 + \text{defs})$, $d_5 = \ln(1 + \text{imports})$.
  - Strictly $\ell_2$-normalized to unit sphere via Kahan compensated summation.
  - Sub-millisecond compute receipts ($< 1$ms, 0 GPU tokens).
  - Calculates Manhattan Heat, Euclidean Shatter, Cosine Distance, and proximity to `COLD_MAP_5_MANIFOLD` failure manifolds (hollow stubs, unstructured code dumps, coupling blowouts, slop-canon hubs).
- **[gates.ts](file:///Users/joewales/jules-jev-harness/server/jev/gates.ts) & [harness.ts](file:///Users/joewales/jules-jev-harness/server/jev/harness.ts) (Beat 2):**
  - **Risky Gate Enforceable Pre-flight:**
    - If `spectral.verdict === "block"` (shatter $> 0.15$ or cold failure proximity), **instantly blocks as a zero-cost rule** (`action: "block"`, `outcome: "escalate"`), preventing corrupted diffs or slop hubs from reaching PR dispatch.
    - If `spectral.verdict === "watch"` ($0.05 \le \text{shatter} \le 0.15$), escalates to affirmative human review.
    - Clean diffs ($\text{shatter} < 0.05$) pass with verified 5-D receipts in gate verdict details.
- **[parser.ts](file:///Users/joewales/jules-jev-harness/server/discovery/parser.ts) & [graph.ts](file:///Users/joewales/jules-jev-harness/server/discovery/graph.ts) (Beat 3):**
  - **Join-Key Schema Registry:** Indexes 14 canonical join keys (`SPATIAL_ZIP5`, `SPATIAL_GEOID`, `CORPORATE_CIK`, `CORPORATE_EIN`, `TEMPORAL_DATE`, `MACRO_SERIES_ID`, etc.) and 6 crosswalk transformation bridges (HUD ZIP-to-Tract, SEC-IRS EIN-to-CIK, SAM UEI-to-EIN).
  - **Dynamic Ingestion:** Ingests 500+ endpoints from `API-All-the-X` and 22 zero-key APIs from `us-gov-open-data`.
  - **Hypothesis Synthesizer:** Traverses property graph to find multi-hop join paths between disparate agencies and generates predictive candidate correlation briefs.
  - **BigQuery GQL Export:** Generates production-ready `CREATE OR REPLACE PROPERTY GRAPH` GoogleSQL DDL adhering to the ISO GQL standard.
- **[jev-plugin.ts](file:///Users/joewales/jules-jev-harness/server/jev-plugin.ts):** Hardened Vite dev middleware with:
  - Host validation (strictly `127.0.0.1`, `localhost`, or opt-in `JEV_ALLOW_LAN`) to block DNS rebinding.
  - Origin validation to block cross-site request forgery.
  - Strict Content-Type enforcement (`application/json`) on mutating POST requests.
  - Strict regex parameter validation (`^[A-Za-z0-9_-]{1,64}$`, `owner/repo`).
  - Endpoints: `GET /api/jules`, `POST /api/jules/dispatch`, `POST /api/jules/:id/approve`, `POST /api/jules/:id/message`, `GET /api/jules/:id`, `POST /api/spectral/score`, `GET /api/discovery/stats`, `GET /api/discovery/hypotheses`, `POST /api/discovery/hypotheses/synthesize`, `GET /api/discovery/gql`, and `POST /api/discovery/dispatch`.

### Frontend Layer (`src/`)
- **[live-step.js](file:///Users/joewales/jules-jev-harness/src/jules/live-step.js):** Pure state transition engine:
  - Deduplicates questions with `askedFor: "<state>:<activityId>"` so a user's NO decision persists without continuous re-prompting.
  - Enforces human confirmation before window opening.
  - Enforces human approval before opening PRs on `risky` verdicts; blocks if not in plan or if spectral radar flags high shatter.
  - Sends tasks back to Jules via done gate if acceptance items are missing.
- **[OrchestrationHub.jsx](file:///Users/joewales/jules-jev-harness/src/components/OrchestrationHub.jsx):**
  - Live Jules session polling every 10s using `useRef` to prevent racing calls.
  - Tracks consecutive errors (warns after 2 failures).
  - Prompts human on dispatch (`"Dispatch to Google Jules?"`).
  - Passes pending diffs to `risky` gate and patches live `spectral` telemetry onto task state.
- **[SpecTelemetryDrawer.jsx](file:///Users/joewales/jules-jev-harness/src/components/SpecTelemetryDrawer.jsx) (Beat 2):**
  - **SPECTRAL TERRAIN · 5-D RADAR:** Interactive radar telemetry panel displaying:
    - 5-D Unit Vector bars: Chars ($d_1$), Hash ($d_2$), Lines ($d_3$), Defs ($d_4$), Imports ($d_5$).
    - Shatter badge (`ANCHOR`, `REVIEW`, `SHATTER_RESOLVE`).
    - Cold Distance ($d_{\text{cold}}$) to nearest failure manifold.
    - Compute receipt duration in milliseconds.
    - Live "Rescan 5-D Radar" trigger calling `POST /api/spectral/score`.
  - External session link: `Open in Jules ↗`.
  - Interactive reply box: allows sending feedback/prompts directly to Jules via `POST /api/jules/:id/message`.
  - Plan review card: explicit `Approve Plan` button calling `POST /api/jules/:id/approve`.
  - Suppresses generic `"Move the tile with Stage Control"` banner on Jules tasks.
  - Keeps acceptance subtasks unticked until 100% completed.
  - Displays PR links directly when open.
- **[DiscoveryGraphModal.jsx](file:///Users/joewales/jules-jev-harness/src/components/DiscoveryGraphModal.jsx) (Beat 3):**
  - **Data Discovery Engine · Property Graph:** Dedicated modal providing:
    - Counter ribbon for indexed endpoints (500+), agencies, canonical join keys (14), and crosswalk bridges (6).
    - Candidate hypothesis cards with visual join paths (`[Source] -> [Bridge] -> [Target]`), lead time estimates, and confidence scores.
    - 1-click **"Dispatch to Jules"** button that mounts the hypothesis directly into the Kanban lane.
    - BigQuery GQL DDL inspector with 1-click copy to clipboard.
    - Canonical join-key registry and crosswalk transformation tables.

---

## 2. Verification Gates Passed

### Automated Tests: 62 / 62 PASS (668ms)
```bash
npm test
```
- **Discovery Graph Engine (6 checks):** Canonical join keys, crosswalk bridges, endpoint ingestion, 1-hop & 2-hop path traversal, hypothesis synthesizer, BigQuery GoogleSQL GQL DDL generation.
- **Jev Gates (21 checks):** Rules, fallbacks, caps, adapter, server route, and Beat 2 Spectral rules (high shatter blocking, hollow stub cold-map blocking, clean diff pass with 5-D details).
- **Spectral Radar Engine (7 checks):** Unit $\ell_2$ hypersphere norm, sub-millisecond execution, 0-shatter anchor, safe harbor, structural fracture threshold ($>0.15$), cold-map proximity, cosine and shatter math.
- **Jules Client (5 checks):** Auth header, 404 mapping, listSources pagination, createSession, approvePlan.
- **Session View (4 checks):** Out-of-order sorting, multi-page lastStep, test command whitelist, state mapping.
- **Route Security & Discovery Routes (12 checks):** Host/Origin CSRF rejection, Content-Type guard, parameter regex, 404 mapping, zero key leakage in responses, POST `/api/spectral/score`, GET `/api/discovery/stats`, GET `/api/discovery/hypotheses`, POST `/api/discovery/dispatch`, GET `/api/discovery/gql`.
- **Live Step Engine (7 checks):** Question deduping, window confirmation, risky gate block, done gate send-back.

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

- Branch: `main`
- Verification Suite: 62 tests passing (0 failures)
- Remote Repository: `https://github.com/Metatronsdoob369/jules-jev-harness.git`
- Persisted to Hive: [[_jules-jev-harness-Hub.md](file:///Users/joewales/Hive/10-Projects/jules-jev-harness/_jules-jev-harness-Hub.md)] and [SESSION_LOG.md](file:///Users/joewales/Hive/20-Session-Log/SESSION_LOG.md).
