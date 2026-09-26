import type { Session, Activity } from "./client.js";

export interface MockJulesOptions {
  /** Array of "owner/repo" strings considered connected. */
  connectedRepos?: string[];
  /** Pre-seeded or dynamic sessions by ID. */
  sessions?: Record<string, { session: Session; activities: Activity[] }>;
  /** Status to respond with (e.g. 401, 404, 500). */
  status?: number;
  /** Latency in ms. */
  latencyMs?: number;
  /** Recorded calls for test assertions. */
  calls?: Array<{ url: string; method: string; body?: unknown }>;
}

export function mockJules(options: MockJulesOptions = {}) {
  const connected = new Set(options.connectedRepos ?? ["your-org/harness"]);
  const sessions = new Map<string, { session: Session; activities: Activity[] }>();

  if (options.sessions) {
    for (const [id, data] of Object.entries(options.sessions)) {
      sessions.set(id, data);
    }
  }

  return async (urlStr: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof urlStr === "string" ? urlStr : urlStr instanceof Request ? urlStr.url : urlStr.toString());
    const method = (init?.method ?? (urlStr instanceof Request ? urlStr.method : "GET")).toUpperCase();
    let body: unknown;
    if (init?.body) {
      try {
        body = JSON.parse(String(init.body));
      } catch {
        body = init.body;
      }
    }

    options.calls?.push({ url: url.toString(), method, body });

    if (options.latencyMs) {
      await new Promise((r) => setTimeout(r, options.latencyMs));
    }

    if (options.status && options.status >= 400) {
      return json({ error: { message: `mock HTTP ${options.status}` } }, options.status);
    }

    const path = url.pathname.replace(/^\/v1alpha\//, "").replace(/^\//, "");

    // GET sources/github/:owner/:repo
    if (method === "GET" && path.startsWith("sources/github/")) {
      const parts = path.split("/");
      const owner = parts[2] ?? "";
      const repo = parts[3] ?? "";
      const key = `${owner}/${repo}`;
      if (connected.has(key)) {
        return json({ name: `sources/github/${key}` });
      }
      return json({ error: { message: "repo not connected to Jules" } }, 404);
    }

    // POST sessions
    if (method === "POST" && path === "sessions") {
      const id = `sess-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const session: Session = {
        name: `projects/p/sessions/${id}`,
        id,
        url: `https://jules.google/session/${id}`,
        state: "PLANNING",
      };
      const activities: Activity[] = [
        {
          name: `${session.name}/activities/act-1`,
          createTime: new Date().toISOString(),
          planGenerated: {
            plan: {
              steps: [
                { index: 1, title: "Analyze requirements", description: "Read project context" },
                { index: 2, title: "Implement code changes", description: "Write main logic" },
              ],
            },
          },
        },
      ];
      sessions.set(id, { session, activities });
      return json(session);
    }

    // GET sessions/:id
    if (method === "GET" && path.startsWith("sessions/") && !path.includes("/activities")) {
      const id = path.split("/")[1] ?? "";
      const found = sessions.get(id);
      if (!found) return json({ error: { message: "session not found" } }, 404);
      return json(found.session);
    }

    // GET sessions/:id/activities
    if (method === "GET" && path.startsWith("sessions/") && path.includes("/activities")) {
      const id = path.split("/")[1] ?? "";
      const found = sessions.get(id);
      if (!found) return json({ error: { message: "session not found" } }, 404);
      return json({ activities: found.activities });
    }

    // POST sessions/:id:approvePlan
    if (method === "POST" && path.includes(":approvePlan")) {
      const idSegment = path.split("/")[1] ?? "";
      const id = idSegment.split(":")[0] ?? "";
      const found = sessions.get(id);
      if (!found) return json({ error: { message: "session not found" } }, 404);

      found.session.state = "IN_PROGRESS";
      found.activities.push({
        name: `${found.session.name}/activities/act-approve`,
        createTime: new Date().toISOString(),
        planApproved: {},
      });
      return json({});
    }

    // POST sessions/:id:sendMessage
    if (method === "POST" && path.includes(":sendMessage")) {
      const idSegment = path.split("/")[1] ?? "";
      const id = idSegment.split(":")[0] ?? "";
      const found = sessions.get(id);
      if (!found) return json({ error: { message: "session not found" } }, 404);

      const reqBody = body as any;
      found.activities.push({
        name: `${found.session.name}/activities/act-msg-${Date.now()}`,
        createTime: new Date().toISOString(),
        userMessaged: { userMessage: reqBody?.prompt },
      });
      return json({});
    }

    return json({ error: { message: "not found" } }, 404);
  };
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
