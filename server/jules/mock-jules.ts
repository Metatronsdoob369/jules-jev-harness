import type { JulesActivity, JulesSession, JulesSource } from "./client.js";

export interface MockJulesOptions {
  sources?: JulesSource[];
  sessions?: Record<string, JulesSession>;
  activities?: Record<string, JulesActivity[]>;
  latencyMs?: number;
  status?: number;
  calls?: Array<{
    url: string;
    method: string;
    body?: unknown;
    headers: Record<string, string>;
  }>;
}

export function mockJules(options: MockJulesOptions = {}): typeof fetch {
  const sources = options.sources ?? [
    { name: "sources/github/Metatronsdoob369/jules-jev-harness", id: "src-1" },
  ];
  const sessions: Record<string, JulesSession> = {
    ...options.sessions,
  };
  const activities: Record<string, JulesActivity[]> = {
    ...options.activities,
  };

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(urlStr, "https://jules.googleapis.com");
    const method = init?.method?.toUpperCase() ?? "GET";
    const headerObj: Record<string, string> = {};

    if (init?.headers) {
      const h = new Headers(init.headers);
      h.forEach((val, key) => {
        headerObj[key.toLowerCase()] = val;
      });
    }

    let parsedBody: unknown = undefined;
    if (init?.body) {
      try {
        parsedBody = JSON.parse(String(init.body));
      } catch {
        parsedBody = String(init.body);
      }
    }

    options.calls?.push({
      url: urlStr,
      method,
      body: parsedBody,
      headers: headerObj,
    });

    if (options.latencyMs) {
      await new Promise((r) => setTimeout(r, options.latencyMs));
    }

    if (options.status) {
      return new Response(JSON.stringify({ error: { message: `mock HTTP ${options.status}` } }), {
        status: options.status,
        headers: { "content-type": "application/json" },
      });
    }

    // Check API Key
    const apiKey = headerObj["x-goog-api-key"];
    if (!apiKey || apiKey === "bad-key") {
      return new Response(JSON.stringify({ error: { message: "Invalid API key" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const path = url.pathname;

    // GET /v1alpha/sources
    if (path.endsWith("/sources") && method === "GET") {
      const pageToken = url.searchParams.get("pageToken");
      if (pageToken === "page-2") {
        return json({ sources: [], nextPageToken: "" });
      }
      return json({ sources, nextPageToken: "" });
    }

    // POST /v1alpha/sessions
    if (path.endsWith("/sessions") && method === "POST") {
      const body = parsedBody as {
        prompt?: string;
        title?: string;
        sourceContext?: { source?: string; githubRepoContext?: { startingBranch?: string } };
      };
      const source = body?.sourceContext?.source ?? "";
      const sourceExists = sources.some((s) => s.name === source);
      if (!sourceExists) {
        return new Response(JSON.stringify({ error: { message: "repo not connected to Jules" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }

      const id = `session-${Object.keys(sessions).length + 1}`;
      const sessionUrl = `https://jules.google.com/sessions/${id}`;
      const newSession: JulesSession = {
        id,
        url: sessionUrl,
        state: "AWAITING_PLAN_APPROVAL",
        title: body.title,
      };
      sessions[id] = newSession;
      activities[id] = [
        {
          name: `activities/act-${id}-1`,
          createTime: new Date().toISOString(),
          planGenerated: {
            plan: {
              steps: [
                { index: 1, title: "Step 1: Setup", description: "Initialize environment" },
                { index: 2, title: "Step 2: Implement", description: "Write feature code" },
                { index: 3, title: "Step 3: Test", description: "Run test suite" },
              ],
            },
          },
        },
      ];
      return json({ id, url: sessionUrl, state: newSession.state });
    }

    // POST /v1alpha/sessions/:id:approvePlan
    if (path.includes(":approvePlan") && method === "POST") {
      const match = /\/sessions\/([^:/]+):approvePlan/.exec(path);
      const id = match?.[1];
      if (!id || !sessions[id]) {
        return new Response(JSON.stringify({ error: { message: "Jules session not found" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      sessions[id].state = "IN_PROGRESS";
      const actList = activities[id] ?? [];
      actList.push({
        name: `activities/act-${id}-${actList.length + 1}`,
        createTime: new Date().toISOString(),
        planApproved: {},
      });
      return json({});
    }

    // POST /v1alpha/sessions/:id:sendMessage
    if (path.includes(":sendMessage") && method === "POST") {
      const match = /\/sessions\/([^:/]+):sendMessage/.exec(path);
      const id = match?.[1];
      if (!id || !sessions[id]) {
        return new Response(JSON.stringify({ error: { message: "Jules session not found" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      const pBody = parsedBody as { prompt?: string };
      const actList = activities[id] ?? [];
      actList.push({
        name: `activities/act-${id}-${actList.length + 1}`,
        createTime: new Date().toISOString(),
        userMessaged: { userMessage: pBody?.prompt ?? "" },
      });
      return json({});
    }

    // GET /v1alpha/sessions/:id/activities
    if (path.includes("/activities") && method === "GET") {
      const match = /\/sessions\/([^/]+)\/activities/.exec(path);
      const id = match?.[1];
      if (!id || !sessions[id]) {
        return new Response(JSON.stringify({ error: { message: "Jules session not found" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      const actList = activities[id] ?? [];
      const pageToken = url.searchParams.get("pageToken");
      const pageSize = parseInt(url.searchParams.get("pageSize") || "30", 10);

      let startIndex = 0;
      if (pageToken?.startsWith("page-")) {
        startIndex = parseInt(pageToken.slice(5), 10) * pageSize;
      }

      const paged = actList.slice(startIndex, startIndex + pageSize);
      const hasMore = startIndex + pageSize < actList.length;
      const nextPage = hasMore ? `page-${Math.floor(startIndex / pageSize) + 1}` : undefined;

      return json({
        activities: paged,
        nextPageToken: nextPage,
      });
    }

    // GET /v1alpha/sessions/:id
    if (path.includes("/sessions/") && method === "GET") {
      const match = /\/sessions\/([^/]+)$/.exec(path);
      const id = match?.[1];
      if (!id || !sessions[id]) {
        return new Response(JSON.stringify({ error: { message: "Jules session not found" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      return json(sessions[id]);
    }

    return new Response(JSON.stringify({ error: { message: "Not found" } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
