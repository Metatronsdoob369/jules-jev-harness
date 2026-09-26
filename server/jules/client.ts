export interface JulesClientConfig {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface Source {
  name: string;
}

export interface CreateSessionOptions {
  prompt: string;
  title?: string;
  source: string;
  startingBranch?: string;
  requirePlanApproval?: boolean;
  automationMode?: string;
}

export interface Session {
  name?: string;
  id?: string;
  url?: string;
  state?: string;
  outputs?: Array<{
    pullRequest?: {
      url?: string;
      title?: string;
      description?: string;
    };
  }>;
}

export interface PlanStep {
  index?: number;
  title?: string;
  description?: string;
}

export interface BashOutput {
  command?: string;
  output?: string;
  exitCode?: number;
}

export interface Activity {
  name?: string;
  createTime?: string;
  planGenerated?: {
    plan?: {
      steps?: PlanStep[];
    };
  };
  progressUpdated?: {
    title?: string;
    description?: string;
  };
  agentMessaged?: {
    agentMessage?: string;
  };
  userMessaged?: {
    userMessage?: string;
  };
  planApproved?: Record<string, unknown>;
  sessionCompleted?: Record<string, unknown>;
  sessionFailed?: {
    reason?: string;
  };
  artifacts?: Array<{
    bashOutput?: BashOutput;
    changeSet?: unknown;
  }>;
}

export interface ListActivitiesResponse {
  activities?: Activity[];
  nextPageToken?: string;
}

export class JulesClient {
  private apiKey: string;
  private baseUrl: string;
  private fetchFn: typeof fetch;
  private timeoutMs: number;

  constructor(config: JulesClientConfig = {}) {
    this.apiKey = config.apiKey ?? "";
    this.baseUrl = (config.baseUrl ?? "https://jules.googleapis.com/v1alpha/").replace(/\/+$/, "");
    this.fetchFn = config.fetch ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/${path.replace(/^\/+/, "")}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    if (this.apiKey) {
      headers["X-Goog-Api-Key"] = this.apiKey;
    }

    try {
      const res = await this.fetchFn(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Jules key missing or invalid");
        }
        if (res.status === 404) {
          throw new Error("repo not connected to Jules");
        }
        let errMessage = `Jules API error HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error?.message) {
            errMessage = body.error.message;
          }
        } catch {
          // fallback to status error
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
      throw new Error("Failed to contact Jules API");
    } finally {
      clearTimeout(timer);
    }
  }

  async getSource(owner: string, repo: string): Promise<Source> {
    return this.request<Source>(`sources/github/${owner}/${repo}`);
  }

  async createSession(opts: CreateSessionOptions): Promise<Session> {
    const body = {
      prompt: opts.prompt,
      title: opts.title,
      sourceContext: {
        source: opts.source,
        githubRepoContext: {
          startingBranch: opts.startingBranch ?? "main",
        },
      },
      requirePlanApproval: opts.requirePlanApproval ?? true,
      automationMode: opts.automationMode ?? "AUTO_CREATE_PR",
    };

    const session = await this.request<Session>("sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (session.name && !session.id) {
      session.id = session.name.split("/").pop();
    }
    return session;
  }

  async getSession(id: string): Promise<Session> {
    const session = await this.request<Session>(`sessions/${id}`);
    if (session.name && !session.id) {
      session.id = session.name.split("/").pop();
    }
    return session;
  }

  async listActivities(id: string, pageToken?: string): Promise<ListActivitiesResponse> {
    const query = new URLSearchParams({ pageSize: "30" });
    if (pageToken) query.set("pageToken", pageToken);
    return this.request<ListActivitiesResponse>(`sessions/${id}/activities?${query.toString()}`);
  }

  async approvePlan(id: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`sessions/${id}:approvePlan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
  }

  async sendMessage(id: string, prompt: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`sessions/${id}:sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
  }
}
