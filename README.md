# Jules + Jev harness

A three.js Kanban board where Jev decides at five fixed gates, and you decide whenever a gate asks.

## What's real and what's simulated

| Part | State |
|---|---|
| The five gates (intake, route, window, risky, done) | **Real.** They run on the app's own server in `server/jev/`, using TypeSafe's SDK. The board uses four today; risky fires once real agents propose merges. |
| Jev's answers | **Real with a key.** Without one, a stand-in answers in Jev's exact reply format, and the board shows `JEV STAND-IN`. |
| Your calls | **Real.** A `confirm` verdict pauses the board with YES / NO. Held tiles show "Needs you" in the side drawer. |
| The agents doing the work (progress, reports, PRs) | **Real with JULES_API_KEY; simulated without it.** When live, sessions run on Google Jules via `server/jules/`. |
| Tokens, time and throughput on each tile | **Simulated** sample numbers. |

## Run it

Needs Node 20.12 or newer.

```sh
npm install
npm run dev         # http://localhost:3000, with the stand-in
npm test            # 41 checks: gates, adapter, routes, live-step engine, and Jules client
```

To go live, copy `.env.example` to `.env`, fill in `TYPESAFE_API_KEY` and/or `JULES_API_KEY`, then restart `npm run dev`. The badges switch to `JEV LIVE` and `JULES LIVE`.

Before real work, set each project's `repo` in `src/data/initialData.js`. The route gate holds any task without a repo.

## How it's wired

```
board (browser)  ──POST /api/gate/:name──▶  server/jev-plugin.ts  ──▶  server/jev (gates)  ──▶  Jev
                 ──GET/POST /api/jules/*─▶                        ──▶  server/jules/       ──▶  Google Jules API
                 ◀──────── verdict / session telemetry ───────────
```

- `server/jev/gate.ts` and `gates.ts` hold the engine and the five gates, copied unchanged from the jev-gates scaffold.
- `server/jev/harness.ts` turns a board tile into what the gates expect, and caps everything the page sends.
- `server/jules/client.ts` talks to Google Jules API v1alpha. The key stays on the server and never reaches the page.
- `server/jules/session-view.ts` normalizes Jules sessions and activities into what the harness expects.
- `server/jev-plugin.ts` mounts the `/api/gate` and `/api/jules` routes on Vite's server with Host, Origin, and Content-Type guards.
- `src/jules/live-step.js` is the pure state machine advancing tiles under Jev gates.

The routes only answer requests from this computer. Set `JEV_ALLOW_LAN=1` in `.env` if other machines on your network need it.

