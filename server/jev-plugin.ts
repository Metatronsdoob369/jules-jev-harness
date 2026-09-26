/**
 * Mounts the jev-gates and jules routes on Vite's own server:
 *
 *   GET  /api/gate          which mode the gates are in, and their names
 *   POST /api/gate/:name    run one gate on one tile, get its verdict back
 *
 *   GET  /api/jules         returns { mode: "live" | "simulated", repos: [...] }
 *   POST /api/jules/dispatch takes { tile, project }, creates session -> { sessionId, url }
 *   GET  /api/jules/:id     returns the session view
 *   POST /api/jules/:id/approve wraps approvePlan
 *   POST /api/jules/:id/message wraps sendMessage
 *
 * The keys stay here in Node and never reach the page.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { createRunner } from "./jev/gate.js";
import { GATE_NAMES, isGateName, runNamed, toGateInput, type GateRequest } from "./jev/harness.js";
import { mockJev } from "./jev/mock-jev.js";
import { JulesClient } from "./jules/client.js";
import { mockJules } from "./jules/mock-jules.js";
import { buildSessionView } from "./jules/session-view.js";

type Next = (err?: unknown) => void;

export function jevGates(env: Record<string, string>): Plugin {
  const jevKey = env.TYPESAFE_API_KEY?.trim();
  const jevMode = jevKey ? "live" : "stand-in";

  const julesKey = env.JULES_API_KEY?.trim();
  const julesMode = julesKey ? "live" : "simulated";

  const allowLan = env.JEV_ALLOW_LAN === "1";

  let jevRunner: ReturnType<typeof createRunner> | undefined;
  const getRunner = () =>
    (jevRunner ??= createRunner({
      clientConfig: jevKey
        ? { apiKey: jevKey }
        : { apiKey: "stand-in", fetch: mockJev({ latencyMs: 120 }), logLevel: "off" },
    }));

  let julesClient: JulesClient | undefined;
  const getJulesClient = () =>
    (julesClient ??= new JulesClient(
      julesKey
        ? { apiKey: julesKey }
        : { apiKey: "simulated", fetch: mockJules({ latencyMs: 120 }) as typeof fetch }
    ));

  async function handle(req: IncomingMessage, res: ServerResponse, next: Next) {
    const rawPath = (req.url ?? "").split("?")[0] ?? "";

    if (rawPath.startsWith("/api/gate")) {
      return handleGate(rawPath, req, res, next);
    }

    if (rawPath.startsWith("/api/jules")) {
      return handleJules(rawPath, req, res, next);
    }

    return next();
  }

  async function handleGate(path: string, req: IncomingMessage, res: ServerResponse, next: Next) {
    if (path !== "/api/gate" && !path.startsWith("/api/gate/")) return next();

    if (!allowLan && !isLoopback(req)) return send(res, 403, { error: "The gates only answer this computer." });

    if (path === "/api/gate") {
      if (req.method !== "GET") return send(res, 405, { error: "Use GET here." });
      return send(res, 200, { mode: jevMode, gates: GATE_NAMES });
    }

    const name = path.slice("/api/gate/".length);
    if (!isGateName(name)) return send(res, 404, { error: `There's no gate called "${name}".` });
    if (req.method !== "POST") return send(res, 405, { error: "Use POST to run a gate." });

    if (!(req.headers["content-type"] ?? "").includes("application/json")) {
      return send(res, 415, { error: "Send JSON." });
    }

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

  async function handleJules(path: string, req: IncomingMessage, res: ServerResponse, next: Next) {
    if (path !== "/api/jules" && !path.startsWith("/api/jules/")) return next();

    if (!allowLan && !isLoopback(req)) return send(res, 403, { error: "Jules only answers this computer." });

    const client = getJulesClient();

    // GET /api/jules
    if (path === "/api/jules") {
      if (req.method !== "GET") return send(res, 405, { error: "Use GET here." });
      let repos: string[] = [];
      return send(res, 200, { mode: julesMode, repos });
    }

    const subPath = path.slice("/api/jules/".length);

    // POST /api/jules/dispatch
    if (subPath === "dispatch") {
      if (req.method !== "POST") return send(res, 405, { error: "Use POST here." });
      if (!(req.headers["content-type"] ?? "").includes("application/json")) {
        return send(res, 415, { error: "Send JSON." });
      }

      let body: any;
      try {
        body = JSON.parse(await readBody(req, 64_000));
      } catch {
        return send(res, 400, { error: "The body must be JSON under 64 KB." });
      }

      const { tile, project } = body ?? {};
      if (!tile || typeof tile.title !== "string") {
        return send(res, 400, { error: "Send a tile with a title." });
      }

      const repoStr = project?.repo || "your-org/harness";
      const [owner, repo] = repoStr.split("/");
      if (!owner || !repo) {
        return send(res, 400, { error: "Invalid repository configuration." });
      }

      let sourceName = `sources/github/${owner}/${repo}`;
      try {
        const sourceRes = await client.getSource(owner, repo);
        if (sourceRes.name) sourceName = sourceRes.name;
      } catch (err: unknown) {
        return send(res, 400, {
          error: err instanceof Error ? err.message : "repo not connected to Jules",
        });
      }

      let prompt = `Task: ${tile.title}\n`;
      if (tile.description) {
        prompt += `Description: ${tile.description}\n`;
      }
      if (Array.isArray(tile.subtasks) && tile.subtasks.length > 0) {
        prompt += `Acceptance Criteria:\n` + tile.subtasks.map((st: string) => `- [ ] ${st}`).join("\n") + "\n";
      }
      prompt += `Work on a branch, run the tests, and open a pull request.`;

      const startingBranch = project?.branch || "main";

      try {
        const session = await client.createSession({
          prompt,
          title: tile.title,
          source: sourceName,
          startingBranch,
          requirePlanApproval: true,
          automationMode: "AUTO_CREATE_PR",
        });

        const sessionId = session.id || session.name?.split("/").pop();
        return send(res, 200, { sessionId, url: session.url });
      } catch (err: unknown) {
        return send(res, 500, {
          error: err instanceof Error ? err.message : "Failed to create Jules session",
        });
      }
    }

    const parts = subPath.split("/");
    const id = parts[0];
    const action = parts[1];

    if (!id) return send(res, 404, { error: "Session ID required" });

    // GET /api/jules/:id
    if (!action) {
      if (req.method !== "GET") return send(res, 405, { error: "Use GET here." });
      try {
        const session = await client.getSession(id);
        const actRes = await client.listActivities(id);
        const view = buildSessionView(session, actRes.activities ?? []);
        return send(res, 200, view);
      } catch (err: unknown) {
        return send(res, 500, {
          error: err instanceof Error ? err.message : "Failed to fetch Jules session",
        });
      }
    }

    // POST /api/jules/:id/approve
    if (action === "approve") {
      if (req.method !== "POST") return send(res, 405, { error: "Use POST here." });
      try {
        await client.approvePlan(id);
        return send(res, 200, { status: "approved" });
      } catch (err: unknown) {
        return send(res, 500, {
          error: err instanceof Error ? err.message : "Failed to approve plan",
        });
      }
    }

    // POST /api/jules/:id/message
    if (action === "message") {
      if (req.method !== "POST") return send(res, 405, { error: "Use POST here." });
      if (!(req.headers["content-type"] ?? "").includes("application/json")) {
        return send(res, 415, { error: "Send JSON." });
      }

      let body: any;
      try {
        body = JSON.parse(await readBody(req, 64_000));
      } catch {
        return send(res, 400, { error: "The body must be JSON under 64 KB." });
      }

      if (typeof body?.prompt !== "string" || !body.prompt.trim()) {
        return send(res, 400, { error: "Send a message prompt." });
      }

      try {
        await client.sendMessage(id, body.prompt.trim());
        return send(res, 200, { status: "sent" });
      } catch (err: unknown) {
        return send(res, 500, {
          error: err instanceof Error ? err.message : "Failed to send message",
        });
      }
    }

    return send(res, 404, { error: "Not found" });
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
