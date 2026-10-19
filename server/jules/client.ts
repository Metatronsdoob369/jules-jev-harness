/**
 * Jules API client wrapper for Google Jules REST API (v1alpha).
 * Handles authentication, timeouts, and plain-English error mapping.
 */

export interface JulesClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface JulesSource {
  name: string;
  id?: string;
}

export interface JulesSession {
  id: string;
  url: string;
  state:
    | "QUEUED"
    | "PLANNING"
    | "AWAITING_PLAN_APPROVAL"
    | "AWAITING_USER_FEEDBACK"
    | "IN_PROGRESS"
    | "PAUSED"
    | "FAILED"
    | "COMPLETED";
  title?: string;
  outputs?: Array<{
    pullRequest?: {
      url: string;
      title: string;
      description?: string;
    };
  }>;
}

export interface JulesActivity {
  name?: string;
  createTime?: string;
  planGenerated?: {
    plan?: {
      steps?: Array<{
        index?: number;
        title: string;
        description?: string;
      }>;
    };
  };
  progressUpdated?: {
    title: string;
    description?: string;
  };
  agentMessaged?: {
    agentMessage: string;
  };
  userMessaged?: {
    userMessage: string;
  };
  planApproved?: Record<string, unknown>;
  sessionCompleted?: Record<string, unknown>;
  sessionFailed?: {
    reason: string;
  };
  artifacts?: Array<{
    bashOutput?: {
      command: string;
      output?: string;
      exitCode: number;
    };
    changeSet?: unknown;
  }>;
}

export class JulesClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: JulesClientOptions = {}) {
    this.apiKey = options.apiKey?.trim();
    this.baseUrl = (options.baseUrl ?? "https://jules.googleapis.com/v1alpha").replace(/\/+$/, "");
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.apiKey) {
      throw new Error("Jules key missing or invalid");
    }

    const url = path.startsWith("http") ? path : `${this.baseUrl}/${path.replace(/^\/+/, "")}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers = new Headers(init?.headers);
      headers.set("X-Goog-Api-Key", this.apiKey);
      if (init?.body && !headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }

      const res = await this.fetchFn(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Jules key missing or invalid");
        }
        if (res.status === 404) {
          if (url.includes("/sources")) {
            throw new Error("repo not connected to Jules (install the Jules GitHub app on it)");
          }
          if (url.includes("/sessions")) {
            throw new Error("Jules session not found");
          }
        }
        let errMessage = `Jules API error (${res.status})`;
        try {
          const errData = (await res.json()) as { error?: { message?: string } };
          if (errData?.error?.message) {
            errMessage = errData.error.message;
          }
        } catch {
          // ignore json parse errors on non-200
        }
        throw new Error(errMessage);
      }

      return (await res.json()) as T;
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          throw new Error("Jules request timed out");
        }
        throw err;
      }
      throw new Error("Unknown error communicating with Jules API");
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Lists all connected sources following nextPageToken up to completion.
   * Extracts clean "owner/repo" names from sources/github/{owner}/{repo}.
   */
  async listSources(): Promise<{ sources: JulesSource[]; repos: string[] }> {
    const sources: JulesSource[] = [];
    const repos: string[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const query: string = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "";
      const res: { sources?: JulesSource[]; nextPageToken?: string } = await this.request<{
        sources?: JulesSource[];
        nextPageToken?: string;
      }>(`sources${query}`);
      if (Array.isArray(res.sources)) {
        for (const s of res.sources) {
          sources.push(s);
          const match = /^sources\/github\/(.+)$/.exec(s.name ?? "");
          if (match && match[1]) {
            repos.push(match[1]);
          }
        }
      }
      pageToken = res.nextPageToken || undefined;
    } while (pageToken);

    return { sources, repos };
  }

  /**
   * Dispatches a new session for a connected repository.
   */
  async createSession(params: {
    prompt: string;
    title: string;
    repo: string;
    startingBranch?: string;
  }): Promise<{ id: string; url: string; state: string }> {
    const body = {
      prompt: params.prompt,
      title: params.title,
      sourceContext: {
        source: `sources/github/${params.repo}`,
        githubRepoContext: {
          startingBranch: params.startingBranch || "main",
        },
      },
      requirePlanApproval: true,
      automationMode: "AUTO_CREATE_PR",
    };

    return this.request<{ id: string; url: string; state: string }>("sessions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Retrieves session metadata and pull request outputs.
   */
  async getSession(id: string): Promise<JulesSession> {
    return this.request<JulesSession>(`sessions/${encodeURIComponent(id)}`);
  }

  /**
   * Fetches one page of activities.
   */
  async listActivities(
    sessionId: string,
    pageToken?: string
  ): Promise<{ activities: JulesActivity[]; nextPageToken?: string }> {
    const params = new URLSearchParams({ pageSize: "30" });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await this.request<{ activities?: JulesActivity[]; nextPageToken?: string }>(
      `sessions/${encodeURIComponent(sessionId)}/activities?${params.toString()}`
    );

    return {
      activities: res.activities ?? [],
      nextPageToken: res.nextPageToken || undefined,
    };
  }

  /**
   * Paginates all activities up to maxPages (safety cap, default 20).
   */
  async listAllActivities(
    sessionId: string,
    maxPages = 20
  ): Promise<{ activities: JulesActivity[]; capped: boolean }> {
    const activities: JulesActivity[] = [];
    let pageToken: string | undefined = undefined;
    let pageCount = 0;
    let capped = false;

    do {
      const page = await this.listActivities(sessionId, pageToken);
      activities.push(...page.activities);
      pageToken = page.nextPageToken;
      pageCount++;
      if (pageToken && pageCount >= maxPages) {
        capped = true;
        break;
      }
    } while (pageToken);

    return { activities, capped };
  }

  /**
   * Approves a generated plan.
   */
  async approvePlan(sessionId: string): Promise<void> {
    await this.request<unknown>(`sessions/${encodeURIComponent(sessionId)}:approvePlan`, {
      method: "POST",
      body: "{}",
    });
  }

  /**
   * Sends a feedback prompt or user reply to the active agent session.
   */
  async sendMessage(sessionId: string, prompt: string): Promise<void> {
    await this.request<unknown>(`sessions/${encodeURIComponent(sessionId)}:sendMessage`, {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
  }
}
