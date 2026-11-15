export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  spaFallback: boolean;
  activeDeploymentId: string | null;
  prodUrl: string;
  createdAt: string;
}

export interface DeploymentRecord {
  id: string;
  projectId: string;
  versionNumber: number;
  status: string;
  filesCount: number;
  sizeBytes: number;
  previewUrl: string;
  createdAt: string;
}

export interface DomainRecord {
  id: string;
  domain: string;
  dnsStatus: "pending" | "verified" | "failed";
  sslStatus: "pending" | "issuing" | "active" | "error";
  verificationError?: string | null;
}

export interface EnvRecord {
  id: string;
  key: string;
  createdAt: string;
  updatedAt: string;
}

export interface FunctionLogRecord {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  logs: string[];
  error?: string;
}

export class RunDeployClient {
  readonly baseUrl: string;
  readonly token: string;

  constructor(params: { baseUrl: string; token: string }) {
    this.baseUrl = params.baseUrl.replace(/\/+$/, "");
    this.token = params.token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.token}`);
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const text = await res.text();
    let json: Record<string, unknown> = {};
    if (text) {
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        // non-JSON response
      }
    }

    if (!res.ok) {
      const msg =
        (typeof json.detail === "string" && json.detail) ||
        (typeof json.title === "string" && json.title) ||
        (typeof json.error === "string" && json.error) ||
        `HTTP ${res.status} ${res.statusText}`;
      const code = typeof json.code === "string" ? json.code : undefined;
      throw new ApiError(res.status, msg, code);
    }

    return json as T;
  }

  me() {
    return this.request<{
      user: { id: string; email: string };
      entitlements: {
        tier: string;
        projects_limit: number;
        max_bundle_mb: number;
        custom_domains: boolean;
      };
    }>("/api/v1/me");
  }

  listProjects() {
    return this.request<{ projects: ProjectRecord[]; total: number; limit: number }>(
      "/api/v1/projects",
    );
  }

  createProject(params: { name: string; slug: string; spaFallback?: boolean }) {
    return this.request<{ project: ProjectRecord }>("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  listDeployments(projectId: string) {
    return this.request<{ deployments: DeploymentRecord[]; activeDeploymentId: string | null }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/deployments`,
    );
  }

  uploadDeployment(params: {
    projectId: string;
    archive: Buffer;
    commitSha?: string;
    commitMessage?: string;
  }) {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(params.archive)], { type: "application/gzip" }),
      "bundle.tar.gz",
    );
    form.append("source", "cli");
    if (params.commitSha) form.append("commitSha", params.commitSha);
    if (params.commitMessage) form.append("commitMessage", params.commitMessage);

    return this.request<{
      deployment: DeploymentRecord;
      prodUrl: string;
      previewUrl: string;
      functionsCount?: number;
    }>(`/api/v1/projects/${encodeURIComponent(params.projectId)}/deployments`, {
      method: "POST",
      body: form,
    });
  }

  rollback(projectId: string, deploymentId: string) {
    return this.request<{ deployment: DeploymentRecord; prodUrl: string }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/deployments/${encodeURIComponent(deploymentId)}/rollback`,
      { method: "POST" },
    );
  }

  listEnv(projectId: string) {
    return this.request<{ variables: EnvRecord[] }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/env`,
    );
  }

  setEnv(projectId: string, key: string, value: string) {
    return this.request<{ variable: EnvRecord }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/env`,
      {
        method: "POST",
        body: JSON.stringify({ key, value }),
      },
    );
  }

  deleteEnv(projectId: string, key: string) {
    return this.request<{ success: boolean }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(key)}`,
      { method: "DELETE" },
    );
  }

  listDomains(projectId: string) {
    return this.request<{ domains: DomainRecord[]; cnameTarget: string; serverIp?: string }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/domains`,
    );
  }

  addDomain(projectId: string, domain: string) {
    return this.request<{
      domain: DomainRecord;
      instructions: {
        cname: { host: string; target: string };
        aRecord?: { host: string; ip: string };
      };
    }>(`/api/v1/projects/${encodeURIComponent(projectId)}/domains`, {
      method: "POST",
      body: JSON.stringify({ domain }),
    });
  }

  verifyDomain(projectId: string, domainId: string) {
    return this.request<{
      domain: DomainRecord;
      verification: { verified: boolean; error?: string };
    }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domainId)}/verify`,
      { method: "POST" },
    );
  }

  deleteDomain(projectId: string, domainId: string) {
    return this.request<{ success: boolean }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domainId)}`,
      { method: "DELETE" },
    );
  }

  getFunctionLogs(projectId: string, limit = 20) {
    return this.request<{ logs: FunctionLogRecord[] }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/functions/logs?limit=${limit}`,
    );
  }
}
