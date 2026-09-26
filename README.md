# Jules + Jev harness

A three.js Kanban board where Jev decides at five fixed gates, and you decide whenever a gate asks.

## What's real and what's simulated

| Part | State |
|---|---|
| The five gates (intake, route, window, risky, done) | **Real.** They run on the app's own server in `server/jev/`, using TypeSafe's SDK. The board uses four today; risky fires once real agents propose merges. |
| Jev's answers | **Real with a key.** Without one, a stand-in answers in Jev's exact reply format, and the board shows `JEV STAND-IN`. |
| Your calls | **Real.** A `confirm` verdict pauses the board with YES / NO. Held tiles show "Needs you" in the side drawer. |
| The agents doing the work (progress, reports, PRs) | Real with `JULES_API_KEY`; simulated without it |
| Tokens, time and throughput on each tile | **Simulated** sample numbers. |

## Run it

Needs Node 20.12 or newer.

```sh
npm install
npm run dev         # http://localhost:3000, with the stand-in
npm test            # 23 checks: the gates, the adapter, the server route, and Jules integration
```

To go live, copy `.env.example` to `.env`, fill in `TYPESAFE_API_KEY` and `JULES_API_KEY`, then restart `npm run dev`. The badge switches to `JEV LIVE` and Jules switches to real sessions.

Before real work, set each project's `repo` in `src/data/initialData.js`. The route gate holds any task without a repo.

## How it's wired

```
board (browser)  ──POST /api/gate/:name──▶  server/jev-plugin.ts  ──▶  server/jev (gates)  ──▶  Jev
                 ◀──────── verdict ────────
                 ──GET/POST /api/jules──▶  server/jev-plugin.ts  ──▶  server/jules (client) ──▶  Jules
```

- `server/jev/gate.ts` and `gates.ts` hold the engine and the five gates, copied unchanged from the jev-gates scaffold.
- `server/jev/harness.ts` turns a board tile into what the gates expect, and caps everything the page sends.
- `server/jev-plugin.ts` mounts the routes on Vite's own server. The Jev and Jules keys stay there and never reach the page.
- `src/gates/gates.js` is the page's side for gates: it asks for a verdict and nothing more.

The route only answers requests from this computer. Set `JEV_ALLOW_LAN=1` in `.env` if other machines on your network need it.
