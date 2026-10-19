# Enforceable PDR: Autonomous Multi-Variable Data Discovery Engine (Phase 2 / Beat 3)

**Status:** RATIFIED & IMPLEMENTED (Beat 3 Complete, 62/62 tests passing)  
**Standard:** FRE 902 / Context-Engineering Compliant / Hive Memory Integrated / BigQuery GQL ISO Standard  
**Target Foundation:** `jules-jev-harness` (Branch: `main`)  
**Data Sources:** `~/Projects/us-gov-open-data`, `~/API-All-the-X`, Treasury Fiscal Data, FRED H.8, SEC EDGAR, USPS PostalPro/DPV  

---

## 1. Goal Description

Establish an autonomous, agent-driven discovery laboratory that continuously tests combinations of ~1,200 federal and macro endpoints (Treasury, Federal Reserve H.8, SEC EDGAR, USPS CASS/DPV, USGov APIs) to uncover non-obvious, actionable correlation signals (e.g. distressed real estate, corporate insolvency, municipal defaults, bond distress).

Instead of human engineers manually guessing and wiring permutations into spaghetti code, the system utilizes:
1. **A Join-Key Schema Registry:** Normalizes disparate endpoints by shared join axes (`SPATIAL_ZIP5`, `SPATIAL_GEOID`, `CORPORATE_CIK`, `CORPORATE_EIN`, `TEMPORAL_DATE`, `MACRO_SERIES_ID`, etc.).
2. **BigQuery Property Graph Topology (ISO GQL Standard):** Maps APIs, Join Keys, and crosswalk bridges as an interconnected property graph (`CREATE OR REPLACE PROPERTY GRAPH`).
3. **Hypothesis Formulation Engine:** Deterministically synthesizes multi-variable correlation experiments via graph path traversal (e.g., *Endpoint X + Endpoint Y over Crosswalk Z*).
4. **Automated Jules Coding Execution:** Dispatches candidate experiments into Jules on isolated Git branches (`exp/*`) where Jules writes the ingestion and backtest code.
5. **Jev Gatekeeper & Spectral Radar Enforcement:** Pre-flight scores code diffs via 5-D Spectral Terrain geometry ($< 1$ms, 0 GPU tokens) and enforces statistical acceptance gates ($p \le 0.01$).
6. **Asset Library of Negative Knowledge:** Persists confirmed correlations into the catalog and dead-ends into `~/Hive` to avoid redundant compute.

---

## 2. The 4-Tier Discovery Architecture

```
[ Tier 1: Federated Property Graph Registry ]
  1,200+ Endpoints (All-the-X / us-gov-open-data / USPS PostalPro / FRED / EDGAR)
  Indexed by: Agency ──▶ Endpoint ──▶ Emits/Accepts Join Keys ──▶ Crosswalk Bridges
                             │
                             ▼
[ Tier 2: Hypothesis Synthesizer (GQL Path Traversal) ]
  MATCH (macro:Endpoint)-[:Emits]->(k1:JoinKey)-[:BridgesTo]->(k2:JoinKey)<-[:Accepts]-(micro:Endpoint)
  "Does [FRED H.8 CRE Delinquency] + [USPS 90-Day DPV Vacancy] predict [EDGAR Lease Default]?"
                             │
                             ▼
[ Tier 3: Jules + Jev Containment Lab ]
  ┌────────────────────────────────────────────────────────────────────────┐
  │ Dispatch ──▶ Jev Intake & Route ──▶ Jules Session on Isolated Branch  │
  │                     │                                                  │
  │                     ▼                                                  │
  │       Jules writes backtest script against cached ground truth         │
  │                     │                                                  │
  │                     ▼                                                  │
  │   Jev Window Gate (Plan Review) ──▶ Jules executes test suite          │
  │                     │                                                  │
  │                     ▼                                                  │
  │   Jev Risky Gate (5-D Spectral Radar Pre-Flight: Shatter < 0.15)       │
  │                     │                                                  │
  │                     ▼                                                  │
  │   Jev Done Gate Assertion (p <= 0.01)                                 │
  └────────────────────────────────────────────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
[ Verified Signal: PR Opened ]           [ Negative Knowledge: Hive ]
New toggleable map layer                 Documented dead-end / asset library
```

---

## 3. Implemented Components (`server/discovery/`, `src/components/`)

### Component 1: The Join-Key Schema Registry (`server/discovery/parser.ts`)
- **14 Canonical Join Keys:** `SPATIAL_ZIP5`, `SPATIAL_GEOID`, `SPATIAL_COORDINATES`, `CORPORATE_CIK`, `CORPORATE_EIN`, `CORPORATE_UEI`, `TEMPORAL_DATE`, `TEMPORAL_MONTH`, `TEMPORAL_QUARTER`, `MACRO_SERIES_ID`, `INDUSTRY_NAICS`, `AGRICULTURE_COMMODITY`, `GOV_AWARD_ID`, `FINANCIAL_CUSIP`.
- **6 Crosswalk Bridges:** HUD-USPS ZIP-to-Tract (98%), SEC-IRS EIN-to-CIK (95%), SAM UEI-to-EIN (99%), Day-to-Month (100%), Month-to-Quarter (100%), Coordinates-to-Tract (99%).
- **Automated Ingestion:** Dynamically ingests `~/API-All-the-X/_data/individual_apis.yml` (> 500 endpoints) and `~/Projects/us-gov-open-data`.

### Component 2: Graph Topology & GQL Generator (`server/discovery/graph.ts`)
- **`DiscoveryGraph`:** In-memory property graph matching BigQuery GQL semantics.
- **`findJoinPaths`:** Traverses direct overlaps and 2-hop crosswalk bridges.
- **`synthesizeHypotheses`:** Generates ranked candidate hypotheses prioritizing high cross-domain predictive divergence.
- **`exportToBigQueryGqlDDL`:** Generates production-ready `CREATE OR REPLACE PROPERTY GRAPH` GoogleSQL statements conforming to BigQuery's ISO GQL standard.

### Component 3: Hardened Server Routes (`server/jev-plugin.ts`)
- `GET /api/discovery/stats`: Live catalog metrics.
- `GET /api/discovery/hypotheses`: Ranked candidate hypotheses.
- `POST /api/discovery/hypotheses/synthesize`: Triggers fresh GQL traversal.
- `GET /api/discovery/gql`: Exports BigQuery GQL DDL.
- `POST /api/discovery/dispatch`: Converts candidate hypothesis into executable Jules task on branch `exp/*`.

### Component 4: Interactive Frontend Modal (`src/components/DiscoveryGraphModal.jsx`)
- Header metrics ribbon (Endpoints, Agencies, Join Keys, Crosswalks).
- Interactive hypothesis cards with join topology path diagrams.
- "Dispatch to Jules" direct execution button.
- BigQuery GQL DDL inspector with 1-click clipboard copy.
- Interactive Join-Key Registry & Crosswalk table.

---

## 4. Verification Suite: 62 / 62 PASS (668ms)

| Test File | Verification Target |
| :--- | :--- |
| `server/discovery/graph.test.ts` | 6 checks: canonical keys, crosswalks, endpoint ingestion, join path finding, hypothesis synthesizer, BigQuery GQL DDL generation. |
| `server/jules/routes.test.ts` | Includes discovery endpoints: `/api/discovery/stats`, `/api/discovery/hypotheses`, `/api/discovery/dispatch`, `/api/discovery/gql`. |
| `server/spectral/fingerprint.test.ts` | 7 checks: 5-D unit norm, sub-ms speed, 0 shatter anchor, safe harbor, fracture threshold, cold-map proximity. |
| `server/jev/*.test.ts` | The original 21 checks: rules, fallbacks, caps, adapter, spectral risky gate blocks. |
| `server/jules/*.test.ts` | Client, mock, session view, out-of-order delivery, command whitelist. |
| `src/jules/live-step.test.js` | 7 state transition checks: question deduping, window confirm, risky PR open, done send-back. |

