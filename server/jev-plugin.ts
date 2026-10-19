/**
 * Mounts the jev-gates and Jules session runner on Vite's own server:
 *
 *   GET  /api/gate             which mode the gates are in, and their names
 *   POST /api/gate/:name       run one gate on one tile, get its verdict back
 *   GET  /api/jules            which mode Jules is in, and connected repos
 *   POST /api/jules/dispatch   start a real Jules session for a tile
 *   GET  /api/jules/:id        session telemetry (plan, progress, tests, PR)
 *   POST /api/jules/:id/approve approve a pending plan
 *   POST /api/jules/:id/message send a user feedback prompt to Jules
 *
 * The gates, and the Jev/Jules keys, live here in Node. The page only sees verdicts and session telemetry.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { createRunner } from "./jev/gate.js";
import { GATE_NAMES, isGateName, runNamed, toGateInput, type GateRequest } from "./jev/harness.js";
import { mockJev } from "./jev/mock-jev.js";
import { JulesClient } from "./jules/client.js";
import { buildSessionView } from "./jules/session-view.js";
import { scoreSpectralDiff } from "./spectral/fingerprint.js";
import { defaultDiscoveryGraph } from "./discovery/graph.js";

type Next = (err?: unknown) => void;

export interface JevGatesOptions {
  julesClient?: JulesClient;
}

const SESSION_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const REPO_REGEX = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function jevGates(env: Record<string, string>, options: JevGatesOptions = {}): Plugin {
  const jevKey = env.TYPESAFE_API_KEY?.trim();
  const jevMode = jevKey ? "live" : "stand-in";
  const julesKey = env.JULES_API_KEY?.trim();
  const julesMode = julesKey || options.julesClient ? "live" : "simulated";
  const allowLan = env.JEV_ALLOW_LAN === "1";

  let runner: ReturnType<typeof createRunner> | undefined;
  const getRunner = () =>
    (runner ??= createRunner({
      clientConfig: jevKey
        ? { apiKey: jevKey }
        : { apiKey: "stand-in", fetch: mockJev({ latencyMs: 120 }), logLevel: "off" },
    }));

  const julesClient =
    options.julesClient ??
    (julesKey ? new JulesClient({ apiKey: julesKey }) : undefined);

  async function handle(req: IncomingMessage, res: ServerResponse, next: Next) {
    const path = (req.url ?? "").split("?")[0] ?? "";
    const isGatePath = path === "/api/gate" || path.startsWith("/api/gate/");
    const isJulesPath = path === "/api/jules" || path.startsWith("/api/jules/");
    const isSpectralPath = path === "/api/spectral" || path.startsWith("/api/spectral/");
    const isDiscoveryPath = path === "/api/discovery" || path.startsWith("/api/discovery/");

    if (!isGatePath && !isJulesPath && !isSpectralPath && !isDiscoveryPath) return next();

    // ── Security Guard 1: Host header check (DNS rebinding prevention) ────────
    const hostHeader = (req.headers["host"] ?? "").trim();
    let hostname = hostHeader;
    if (hostname.startsWith("[")) {
      const closing = hostname.indexOf("]");
      hostname = closing !== -1 ? hostname.slice(0, closing + 1) : hostname;
    } else {
      hostname = hostname.split(":")[0] ?? "";
    }
    hostname = hostname.toLowerCase();
    const isAllowedHost = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);

    if (!allowLan && (!isAllowedHost || !isLoopback(req))) {
      return send(res, 403, { error: "The gates only answer this computer." });
    }

    // ── Security Guard 2: Origin header check (CSRF prevention) ───────────────
    const origin = req.headers["origin"];
    if (origin) {
      const expectedHttp = `http://${hostHeader}`;
      const expectedHttps = `https://${hostHeader}`;
      if (origin !== expectedHttp && origin !== expectedHttps) {
        return send(res, 403, { error: "Foreign origin refused." });
      }
    }

    // ── Security Guard 3: Content-Type check on POST ──────────────────────────
    if (req.method === "POST") {
      const cType = (req.headers["content-type"] ?? "").toLowerCase();
      if (!cType.includes("application/json")) {
        return send(res, 415, { error: "Send JSON." });
      }
    }

    // ── Gate Routes ───────────────────────────────────────────────────────────
    if (isGatePath) {
      if (path === "/api/gate") {
        if (req.method !== "GET") return send(res, 405, { error: "Use GET here." });
        return send(res, 200, { mode: jevMode, gates: GATE_NAMES });
      }

      const name = path.slice("/api/gate/".length);
      if (!isGateName(name)) return send(res, 404, { error: `There's no gate called "${name}".` });
      if (req.method !== "POST") return send(res, 405, { error: "Use POST to run a gate." });

      let body: GateRequest;
      try {
        body = JSON.parse(await readBody(req, 64_000)) as GateRequest;
      } catch {
        return send(res, 400, { error: "The body must be JSON under 64 KB." });
      }
      if (typeof body?.tile?.title !== "string") return send(res, 400, { error: "Send a tile with a title." });

      try {
        const verdict = await runNamed(getRunner(), name, toGateInput(body));
        return send(res, 200, { ...verdict, mode: jevMode });
      } catch (err) {
        return send(res, 500, { error: err instanceof Error ? err.message : "The gate failed." });
      }
    }

    // ── Spectral Routes ───────────────────────────────────────────────────────
    if (isSpectralPath) {
      if (path === "/api/spectral/score") {
        if (req.method !== "POST") return send(res, 405, { error: "Use POST to score spectral geometry." });
        let body: { text?: string; baseline?: string };
        try {
          body = JSON.parse(await readBody(req, 64_000));
        } catch {
          return send(res, 400, { error: "The body must be JSON under 64 KB." });
        }
        if (typeof body?.text !== "string") {
          return send(res, 400, { error: "Send text to score." });
        }
        const report = scoreSpectralDiff(body.text, body.baseline);
        return send(res, 200, { ...report, mode: "5-D structural" });
      }
      return send(res, 404, { error: "Unknown spectral route." });
    }

    // ── Discovery Routes (Beat 3) ─────────────────────────────────────────────
    if (isDiscoveryPath) {
      if (path === "/api/discovery/stats") {
        if (req.method !== "GET") return send(res, 405, { error: "Use GET here." });
        return send(res, 200, defaultDiscoveryGraph.getStats());
      }

      if (path === "/api/discovery/hypotheses") {
        if (req.method !== "GET") return send(res, 405, { error: "Use GET here." });
        return send(res, 200, {
          hypotheses: defaultDiscoveryGraph.hypotheses,
          stats: defaultDiscoveryGraph.getStats(),
        });
      }

      if (path === "/api/discovery/hypotheses/synthesize") {
        if (req.method !== "POST") return send(res, 405, { error: "Use POST to synthesize hypotheses." });
        const synthesized = defaultDiscoveryGraph.synthesizeHypotheses(15);
        return send(res, 200, {
          hypotheses: synthesized,
          stats: defaultDiscoveryGraph.getStats(),
        });
      }

      if (path === "/api/discovery/gql") {
        if (req.method !== "GET") return send(res, 405, { error: "Use GET here." });
        const ddl = defaultDiscoveryGraph.exportToBigQueryGqlDDL();
        return send(res, 200, { ddl });
      }

      if (path === "/api/discovery/dispatch") {
        if (req.method !== "POST") return send(res, 405, { error: "Use POST to dispatch." });
        let body: { hypothesisId?: string };
        try {
          body = JSON.parse(await readBody(req, 64_000));
        } catch {
          return send(res, 400, { error: "The body must be JSON under 64 KB." });
        }
        const hyp = defaultDiscoveryGraph.hypotheses.find((h) => h.id === body.hypothesisId);
        if (!hyp) {
          return send(res, 404, { error: "Hypothesis not found in active catalog." });
        }

        const candidateTask = {
          id: `TSK-${Math.floor(400 + Math.random() * 99)}`,
          title: hyp.title,
          column: "BACKLOG",
          lane: "READY",
          state: "ready",
          projectId: "proj-02",
          project: "Discovery Lab (Phase 2)",
          assignee: "Jules + Jev",
          progress: 0,
          tokensUsed: 14500,
          actualTimeMinutes: 0,
          avgThroughputTps: 110,
          subtasks: [
            `Ingest test slices from ${hyp.sourceEndpoint.name} and ${hyp.targetEndpoint.name}`,
            `Align time-series on join axis [${hyp.joinPath.fromKey}${
              hyp.joinPath.viaCrosswalk ? ` -> ${hyp.joinPath.toKey}` : ""
            }]`,
            `Calculate Pearson/Spearman r (assertion p <= 0.01)`
          ],
          repo: "Metatronsdoob369/jules-jev-harness",
          branch: `exp/${hyp.id.replace(/[^a-z0-9_-]/g, "_")}`,
          brief: `${hyp.rationale}\n\nGround Truth: Test statistical significance of lead-indicator shift (Lead: ${hyp.estimatedLeadTimeDays} days). P-value must satisfy p <= 0.01.`,
          acceptanceCriteria: [
            `Ingest test slices from ${hyp.sourceEndpoint.name} and ${hyp.targetEndpoint.name}`,
            `Align time-series on join axis [${hyp.joinPath.fromKey}${
              hyp.joinPath.viaCrosswalk ? ` -> ${hyp.joinPath.toKey}` : ""
            }]`,
            `Calculate Pearson/Spearman r and p-value assertion (p <= 0.01)`,
            `Generate reproducible backtest report in reports/`,
          ],
          pending: {
            diff: `# Discovery Ingestion Adapter: ${hyp.sourceEndpoint.name} + ${hyp.targetEndpoint.name}\nimport { queryFiscalData } from "us-gov-open-data-mcp/sdk/treasury";\n// Join on: ${hyp.joinPath.fromKey}\nexport async function runBacktest() { /* statistical assertions */ }`,
            baseline: `# Baseline Discovery Adapter\nexport async function runBacktest() { return { pValue: 1.0 }; }`,
          },
        };

        return send(res, 200, {
          success: true,
          task: candidateTask,
          hypothesis: hyp,
        });
      }

      return send(res, 404, { error: "Unknown discovery route." });
    }
    if (isJulesPath) {
      // GET /api/jules
      if (path === "/api/jules") {
        if (req.method !== "GET") return send(res, 405, { error: "Use GET here." });
        if (julesMode === "simulated" || !julesClient) {
          return send(res, 200, { mode: "simulated", repos: [] });
        }
        try {
          const { repos } = await julesClient.listSources();
          return send(res, 200, { mode: "live", repos });
        } catch (err) {
          return send(res, 200, {
            mode: "live",
            repos: [],
            error: err instanceof Error ? err.message : "Failed to load connected repositories",
          });
        }
      }

      // POST /api/jules/dispatch
      if (path === "/api/jules/dispatch") {
        if (req.method !== "POST") return send(res, 405, { error: "Use POST to dispatch." });
        if (!julesClient) {
          return send(res, 400, { error: "Jules API key not configured on server." });
        }

        let body: {
          tile?: { id?: string; title?: string; description?: string; subtasks?: string[] };
          project?: { name?: string; repo?: string; branch?: string };
        };
        try {
          body = JSON.parse(await readBody(req, 64_000));
        } catch {
          return send(res, 400, { error: "The body must be JSON under 64 KB." });
        }

        const repo = body.project?.repo?.trim();
        if (!repo || repo === "your-org/harness" || !REPO_REGEX.test(repo)) {
          return send(res, 400, { error: "Set this project's repo in src/data/initialData.js." });
        }
        if (!body.tile?.title || typeof body.tile.title !== "string") {
          return send(res, 400, { error: "Send a tile with a title." });
        }

        const subtasks = Array.isArray(body.tile.subtasks) ? body.tile.subtasks : [];
        let prompt = `${body.tile.title}\n\n${body.tile.description || ""}`;
        if (subtasks.length > 0) {
          prompt += `\n\nAcceptance items:\n${subtasks.map((s) => `- [ ] ${s}`).join("\n")}`;
        }
        prompt +=
          "\n\nWork on a branch, run the tests, and open a pull request.\nDon't deploy anything, and don't use MCP tools such as Render or Stitch.";

        try {
          const result = await julesClient.createSession({
            prompt,
            title: body.tile.title,
            repo,
            startingBranch: body.project?.branch || "main",
          });
          return send(res, 200, { sessionId: result.id, url: result.url });
        } catch (err) {
          return send(res, 500, { error: err instanceof Error ? err.message : "Dispatch failed" });
        }
      }

      // POST /api/jules/:id/approve
      const approveMatch = /^\/api\/jules\/([^/]+)\/approve$/.exec(path);
      if (approveMatch) {
        if (req.method !== "POST") return send(res, 405, { error: "Use POST to approve plan." });
        if (!julesClient) return send(res, 400, { error: "Jules API key not configured." });
        const sessionId = approveMatch[1] ?? "";
        if (!SESSION_ID_REGEX.test(sessionId)) return send(res, 400, { error: "Invalid session ID." });

        try {
          await julesClient.approvePlan(sessionId);
          return send(res, 200, { ok: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to approve plan";
          const status = msg.includes("not found") ? 404 : 500;
          return send(res, status, { error: msg });
        }
      }

      // POST /api/jules/:id/message
      const messageMatch = /^\/api\/jules\/([^/]+)\/message$/.exec(path);
      if (messageMatch) {
        if (req.method !== "POST") return send(res, 405, { error: "Use POST to send message." });
        if (!julesClient) return send(res, 400, { error: "Jules API key not configured." });
        const sessionId = messageMatch[1] ?? "";
        if (!SESSION_ID_REGEX.test(sessionId)) return send(res, 400, { error: "Invalid session ID." });

        let body: { prompt?: string };
        try {
          body = JSON.parse(await readBody(req, 64_000));
        } catch {
          return send(res, 400, { error: "The body must be JSON under 64 KB." });
        }
        if (!body.prompt || typeof body.prompt !== "string") {
          return send(res, 400, { error: "Send a prompt string." });
        }

        try {
          await julesClient.sendMessage(sessionId, body.prompt);
          return send(res, 200, { ok: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to send message";
          const status = msg.includes("not found") ? 404 : 500;
          return send(res, status, { error: msg });
        }
      }

      // GET /api/jules/:id
      const sessionMatch = /^\/api\/jules\/([^/]+)$/.exec(path);
      if (sessionMatch) {
        if (req.method !== "GET") return send(res, 405, { error: "Use GET to inspect session." });
        if (!julesClient) return send(res, 400, { error: "Jules API key not configured." });
        const sessionId = sessionMatch[1] ?? "";
        if (!SESSION_ID_REGEX.test(sessionId)) return send(res, 400, { error: "Invalid session ID." });

        try {
          const session = await julesClient.getSession(sessionId);
          const { activities, capped } = await julesClient.listAllActivities(sessionId, 20);
          const view = buildSessionView(session, activities, { capped });
          return send(res, 200, view);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to load session";
          const status = msg.includes("not found") ? 404 : 500;
          return send(res, status, { error: msg });
        }
      }

      return send(res, 404, { error: "Unknown Jules endpoint." });
    }
  }

  const mount = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((req, res, next) => {
      handle(req, res, next).catch(next);
    });
  };

  return {
    name: "jev-gates",
    configureServer: mount,
    configurePreviewServer: mount,
  };
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const isLoopback = (req: IncomingMessage) => LOOPBACK.has(req.socket.remoteAddress ?? "");

function send(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("too large"));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
