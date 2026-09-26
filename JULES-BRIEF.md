# Brief: replace the simulated agents with real Jules sessions

Read `README.md` first. Today the Jev gates are real, but the agents doing the work are simulated. Your job is to make tiles run on real Jules sessions whenever a Jules API key is present. Without a key, the board must behave exactly as it does now.

## Hard rules

1. **Nothing simulated may be presented as real.** If a part can't be done for real, stop and say so in your summary. Don't fake it: the first version of this harness simulated its whole integration and called it done.
2. **Don't change `server/jev/gate.ts` or `server/jev/gates.ts`.** They're shared with another project and fully tested. You may change `server/jev/harness.ts` and `server/jev-plugin.ts`.
3. **The Jules key stays on the server.** Read `JULES_API_KEY` from `.env` in the Vite plugin, the same way `TYPESAFE_API_KEY` is read. It must never reach the page. After `npm run build`, confirm that `grep -r "JULES_API_KEY\|jules.googleapis.com" dist/` finds nothing.
4. **Tests never call the real Jules API**, and neither should you from your VM. Build against the docs below and a mock (`server/jules/mock-jules.ts`) that speaks the same wire format, the way `server/jev/mock-jev.ts` does for Jev.
5. **Every real dispatch asks the person first.** Each one starts a real Jules session, and the account has a daily session limit, so it's always a YES/NO, never automatic.
6. **The harness never merges.** When a pull request is ready, the risky gate runs; YES opens the PR on GitHub for the person to merge.
7. Keep `npm test`, `npm run typecheck` and `npm run build` passing, and open a pull request with the change.

## The Jules API (v1alpha, may change)

Base URL `https://jules.googleapis.com/v1alpha/`, header `X-Goog-Api-Key: <key>`.

| Call | Use |
|---|---|
| `GET sources` | Confirm a project's repo is connected: `sources/github/{owner}/{repo}`. The Jules GitHub app must be installed on it. |
| `POST sessions` | Body: `{ prompt, title, sourceContext: { source, githubRepoContext: { startingBranch } }, requirePlanApproval: true, automationMode: "AUTO_CREATE_PR" }`. Returns the session (`id`, `url`, `state`). |
| `GET sessions/{id}` | `state` is one of QUEUED, PLANNING, AWAITING_PLAN_APPROVAL, AWAITING_USER_FEEDBACK, IN_PROGRESS, PAUSED, FAILED, COMPLETED. `outputs[].pullRequest` has `url`, `title`, `description`. |
| `GET sessions/{id}/activities?pageSize=30` | Paged (`pageToken`). Each activity has one of: `planGenerated.plan.steps[]` (`index`, `title`, `description`), `progressUpdated` (`title`, `description`), `agentMessaged.agentMessage`, `userMessaged`, `planApproved`, `sessionCompleted`, `sessionFailed.reason`. `artifacts[]` may hold `bashOutput` (`command`, `output`, `exitCode`) or `changeSet`. |
| `POST sessions/{id}:approvePlan` | Empty body. |
| `POST sessions/{id}:sendMessage` | Body `{ prompt }`. |

## What to build

### 1. Server: `server/jules/`

- `client.ts`: a small `fetch` wrapper for the calls above. No new dependencies. Give every call a timeout, and turn errors into plain messages ("Jules key missing or invalid", "repo not connected to Jules").
- `session-view.ts`: turns a session plus its activities into what the board and gates need:
  - `plan`: the plan step titles.
  - `progress`: 0 to 95 from progress updates against plan steps, and 100 only when COMPLETED.
  - `lastStep`: the newest `progressUpdated` title and description.
  - `report`: `summary` from the PR description (falling back to the last agent message), `prUrl` from `outputs[].pullRequest.url`, and `testsPassed` from the newest test command's `bashOutput.exitCode` (0 means true, anything else false, no test run means undefined).
  - `needsYou`: set for AWAITING_PLAN_APPROVAL, AWAITING_USER_FEEDBACK (with Jules's last message) and FAILED (with the reason).
- New routes on the Vite plugin. They get the same guards as `/api/gate`: this computer only, JSON only, a size cap, and plain-English errors.
  - `GET /api/jules` returns `{ mode: "live" | "simulated", repos: [...] }`, listing connected repos when live.
  - `POST /api/jules/dispatch` takes `{ tile, project }`, creates the session and returns `{ sessionId, url }`. Build the prompt from the tile: title, description, and the acceptance items (the tile's `subtasks`) as a checklist, then "Work on a branch, run the tests, and open a pull request." Use `startingBranch` from `project.branch`, defaulting to `main`.
  - `GET /api/jules/:id` returns the session view.
  - `POST /api/jules/:id/approve` and `POST /api/jules/:id/message` wrap `approvePlan` and `sendMessage`.

### 2. Board: `src/components/OrchestrationHub.jsx`

When `GET /api/jules` says live:

- **Dispatch.** A `jules` verdict from the route gate asks "Start a Jules session for TSK-x?" instead of calling `start()`. On YES, dispatch, then store `sessionId` and `sessionUrl` on the tile with `onPatchTask`. The `writer` route stays simulated for now, and the tile says so.
- **Polling.** Poll each running session every 10 seconds, never faster. `advance()` keeps driving simulated tiles only.
- **Plan.** AWAITING_PLAN_APPROVAL shows the plan steps in the drawer (`SpecTelemetryDrawer.jsx`) and asks YES/NO. YES calls approve. NO flags the tile, and a reply box in the drawer sends the person's changes with `message`.
- **Windows.** Each new progress update on a tile with checkpoints runs the window gate with the real `lastStep`. Jev judges whether it's a clean stop. On YES, open the Jules session so the person can review it, and log that the review is manual; bringing in another model isn't built yet.
- **Feedback.** AWAITING_USER_FEEDBACK flags the tile with Jules's message, and the drawer's reply box sends the answer.
- **Done.** COMPLETED runs the done gate with the real `report`. If it sends the tile back, ask "Ask Jules to finish: {missing items}?", and YES sends that as a message. If it passes, run the risky gate with `pending: { kind: "merge", detail: "Merge {prUrl}" }`. YES opens the PR URL.
- **Failed.** FAILED flags the tile with the reason.
- **Links.** Tiles with a session show a link to it in the drawer.

When it isn't live, the current simulation stays exactly as it is.

### 3. Tests: `server/jules/*.test.ts`, using the mock

Cover the dispatch request body, every state's mapping in `session-view.ts`, progress and `lastStep`, PR and tests into `report`, failure into `needsYou`, the route guards, and that no response ever contains the key.

## Done means

- `npm test` passes: the existing 18 checks plus yours.
- `npm run typecheck` and `npm run build` pass, and the `dist/` grep from rule 3 comes back empty.
- `.env.example` gains a blank `JULES_API_KEY=` line.
- In `README.md`'s "What's real" table, the agents row reads "Real with `JULES_API_KEY`; simulated without it".
- Your summary lists anything you couldn't make real.
