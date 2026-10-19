# Enforceable PDR: Autonomous Multi-Variable Data Discovery Engine (Phase 2)

**Status:** Proposed Architecture & Execution Plan  
**Standard:** FRE 902 / Context-Engineering Compliant / Hive Memory Integrated  
**Target Foundation:** `jules-jev-harness` (Branch: `fix/live-jules`)  
**Data Sources:** `~/Projects/us-gov-open-data`, `~/API-All-the-X`, Treasury Fiscal Data, FRED H.8, SEC EDGAR, USPS PostalPro/DPV  

---

## 1. Goal Description

Establish an autonomous, agent-driven discovery laboratory that continuously tests combinations of ~1,200 federal and macro endpoints (Treasury, Federal Reserve H.8, SEC EDGAR, USPS CASS/DPV, USGov APIs) to uncover non-obvious, actionable correlation signals (e.g. distressed real estate, corporate insolvency, municipal defaults, bond distress).

Instead of human engineers manually guessing and wiring permutations into spaghetti code, the system utilizes:
1. **A Join-Key Schema Registry:** Normalizes disparate endpoints by shared join axes (`GEOID/ZIP`, `CIK/EIN`, `Date/Epoch`, `NAICS/Industry`).
2. **Hypothesis Formulation Engine:** Proposes bounded multi-variable correlation experiments (e.g., *Endpoint X + Endpoint Y over Layer Z*).
3. **Automated Jules Coding Execution:** Dispatches each experiment as an isolated Git branch where Google Jules writes and executes the ingestion and backtest script.
4. **Jev Gatekeeper Enforcement:** Enforces that every proposed signal meets strict statistical significance and data-integrity gates before opening a Pull Request into the production data catalog.
5. **Asset Library of Negative Knowledge:** Persists both confirmed correlations (PRs) and disproven hypotheses (Hive session logs) to avoid redundant compute.

---

## 2. The 4-Tier Discovery Architecture

```
[ Tier 1: Cellar Registry ]
  1,200+ Endpoints (All-the-X / us-gov-open-data / USPS PostalPro / FRED / EDGAR)
  Categorized by: Domain ──▶ Agency Room ──▶ Shared Join Keys (ZIP, CIK, Date)
                             │
                             ▼
[ Tier 2: Hypothesis Synthesizer ]
  Generates targeted correlation briefs:
  "Does [FRED H.8 CRE Delinquency] + [USPS 90-Day DPV Vacancy] predict [EDGAR Lease Default]?"
                             │
                             ▼
[ Tier 3: Jules + Jev Containment Lab (fix/live-jules) ]
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
  │   Jev Risky Gate (Rate Limit/Budget) ──▶ Jev Done Gate (p < 0.01)      │
  └────────────────────────────────────────────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
[ Verified Signal: PR Opened ]           [ Negative Knowledge: Hive ]
New toggleable map layer                 Documented dead-end / asset library
```

---

## 3. Core Components & Implementation Spec

### Component 1: The Join-Key Schema Registry (`registry/`)
Rather than dumping 1,200 flat tools into an agent's context window (which blows the token budget and induces hallucinations), endpoints are indexed into a lightweight SQLite/JSON catalog indexed by **Join Keys**:

| Primary Join Key | Canonical Format | Target Endpoints Example | Actionable Output |
|---|---|---|---|
| `SPATIAL_GEOID` | 5-digit ZIP / 11-digit Census Tract | USPS DPV Vacancy, TIGER Geocoder, Census ACS, FEMA flood hazards | Distressed physical assets, abandoned parcels |
| `CORPORATE_ID` | SEC CIK / Federal UEI / EIN | SEC EDGAR (10-K, 10-Q), USASpending Awards, SAM.gov exclusions | Corporate lease abandonment, vendor distress |
| `MACRO_CREDIT` | Federal Reserve Series ID / Date | FRED H.8 (Bank assets & credit), Treasury Daily Debt, Yield Curve | Regional liquidity crunch, lending contraction |
| `MUNICIPAL_TAX` | County FIPS / AISU ID | PostalPro AISU Jurisdiction, Treasury Fiscal Data, Tax lien rolls | Pre-foreclosure notice, municipal bond risk |

### Component 2: Hypothesis Formulation Engine
A structured prompt pattern that generates candidate triples:
$$\text{Hypothesis} = (\text{Independent Variable } X_1) + (\text{Independent Variable } X_2) \xrightarrow{\text{Lead Time } \Delta t} (\text{Ground Truth Event } Y)$$

**Example Experiment Brief:**
> *"Brief: Pull FRED H.8 Commercial Real Estate loan volume (Series `H8B1023NCBC`) and USPS PostalPro DPV 90-day residential vacancy for Jefferson County, AL (`GEOID: 01073`). Test whether a 2-quarter contraction in bank lending combined with a $>15\%$ jump in 90-day vacancy predicts municipal tax auction filings with a 90-day lead time."*

### Component 3: The Jules Autonomous Test Lab
Using the harness we built in Phase 1:
1. `POST /api/jules/dispatch` spins up an autonomous coding session on branch `exp/<experiment-id>`.
2. Jules generates an ingestion adapter and statistical test using Python (`scipy.stats` / `duckdb`) or TypeScript.
3. Jules runs the backtest locally against cached test slices (zero billing/API toll).
4. **Jev Done Gate Assertion:**
   - Must output a standardized summary: `{ correlation_r, p_value, lead_time_days, false_positive_rate }`.
   - Gate rejects and sends back to Jules if $p > 0.05$ or if backtest code lacks reproducible assertions.

### Component 4: Dual Resolution
- **Win Condition ($p \le 0.01$):** Jules automatically formats a Pull Request into the main repo, adding the newly discovered dataset combination as an active "layer toggle" on the 3D Kanban / map interface.
- **Fail Condition ($p > 0.05$):** The negative result, code artifacts, and anomalies are logged directly to `~/Hive/20-Session-Log` as an asset library of verified non-correlations.

---

## 4. Immediate Two-Step Action Plan (Looping Back to A)

To ensure we never sacrifice engineering rigor or leave half-finished code behind:

### Step 1: Complete and Land Option A (The Anchor)
1. **GitHub PR Review:** Visit the opened branch `fix/live-jules` at:
   `https://github.com/Metatronsdoob369/jules-jev-harness/pull/new/fix/live-jules`
2. **Live Smoke Run:**
   - Add test `JULES_API_KEY` into local `.env`.
   - Run `npm run dev`.
   - Dispatch one real live test tile to Jules and verify that Jev's `Window` and `Risky` gates halt the agent cleanly for human review.
3. **Merge `fix/live-jules` to `main`:** Lock in our 41 passing tests as the new production baseline.

### Step 2: Initialize Option B Registry (The Discovery Track)
1. Write a script `scripts/index_cellar_endpoints.ts` that ingests `~/API-All-the-X/_data/individual_apis.yml` and `~/Projects/us-gov-open-data` into the Join-Key Schema Registry.
2. Define the first 3 candidate hypothesis templates (FRED H.8 + USPS DPV + Treasury Debt).
3. Connect the candidate hypothesis generator into the board backlog as automated discovery tiles.
