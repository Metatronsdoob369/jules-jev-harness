/**
 * Mounts the jev-gates on Vite's own server:
 *
 *   GET  /api/gate          which mode the gates are in, and their names
 *   POST /api/gate/:name    run one gate on one tile, get its verdict back
 *
 * The gates, and the Jev key, live here in Node. The page only sees verdicts.
 * With TYPESAFE_API_KEY in .env the gates call real Jev. Without it they run
 * against the stand-in (same SDK, same wire format), and every verdict says so.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { createRunner } from "./jev/gate.js";
import { GATE_NAMES, isGateName, runNamed, toGateInput, type GateRequest } from "./jev/harness.js";
import { mockJev } from "./jev/mock-jev.js";

type Next = (err?: unknown) => void;

export function jevGates(env: Record<string, string>): Plugin {
  const key = env.TYPESAFE_API_KEY?.trim();
  const mode = key ? "live" : "stand-in";
  const allowLan = env.JEV_ALLOW_LAN === "1";
  let runner: ReturnType<typeof createRunner> | undefined;
  const getRunner = () =>
    (runner ??= createRunner({
      clientConfig: key
        ? { apiKey: key }
        : { apiKey: "stand-in", fetch: mockJev({ latencyMs: 120 }), logLevel: "off" },
    }));

  async function handle(req: IncomingMessage, res: ServerResponse, next: Next) {
    const path = (req.url ?? "").split("?")[0] ?? "";
    if (path !== "/api/gate" && !path.startsWith("/api/gate/")) return next();

    // The gates spend your Jev quota: only this computer may call them, unless you opt in.
    if (!allowLan && !isLoopback(req)) return send(res, 403, { error: "The gates only answer this computer." });

    if (path === "/api/gate") {
      if (req.method !== "GET") return send(res, 405, { error: "Use GET here." });
      return send(res, 200, { mode, gates: GATE_NAMES });
    }

    const name = path.slice("/api/gate/".length);
    if (!isGateName(name)) return send(res, 404, { error: `There's no gate called "${name}".` });
    if (req.method !== "POST") return send(res, 405, { error: "Use POST to run a gate." });
    // Requiring JSON makes browsers preflight cross-site calls, which Vite's CORS rules refuse.
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
      return send(res, 200, { ...verdict, mode });
    } catch (err) {
      return send(res, 500, { error: err instanceof Error ? err.message : "The gate failed." });
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
