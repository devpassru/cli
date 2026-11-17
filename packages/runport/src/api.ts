export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface RunPortTunnelRecord {
  subdomain: string | null;
  port: number | null;
  custom_domain: string | null;
  is_reserved: boolean | null;
  auth_user: string | null;
  ip_whitelist: string | null;
  is_review_mode: boolean | null;
  isOnline: boolean;
}

export interface RunPortUserResponse {
  id: string;
  email: string;
  role: string;
  planName: string;
  planType: string;
  maxTunnels: number;
  rpsLimit: number;
  sessionLimit: number;
  bandwidthLimit: number;
  bandwidthUsed: number;
  tunnels: RunPortTunnelRecord[];
}

export interface RunPortKeyRecord {
  id: number;
  fingerprint: string;
  name: string;
  created_at: string;
}

export interface RunPortLogRecord {
  id: string;
  subdomain: string;
  method: string;
  path: string;
  status_code: number | null;
  duration_ms: number | null;
  timestamp: string;
}

export interface RunPortReviewRecord {
  id: string;
  review_number: number;
  subdomain: string;
  path: string;
  selector: string;
  component_name: string | null;
  element_text: string | null;
  comment: string;
  author_name: string | null;
  status: "open" | "resolved";
  created_at: string;
}

export class RunPortClient {
  readonly baseUrl: string;
  readonly token: string;

  constructor(params: { baseUrl: string; token: string }) {
    this.baseUrl = params.baseUrl.replace(/\/+$/, "");
    this.token = params.token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.token}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const text = await res.text();
    let json: unknown = {};
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        // non-JSON response
      }
    }

    if (!res.ok) {
      const obj =
        typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
      const msg =
        (typeof obj.error === "string" && obj.error) ||
        (typeof obj.message === "string" && obj.message) ||
        `HTTP ${res.status} ${res.statusText}`;
      throw new ApiError(res.status, msg);
    }

    return json as T;
  }

  me() {
    return this.request<RunPortUserResponse>("/api/user");
  }

  reserveTunnel(params: { subdomain?: string; port?: number; customDomain?: string }) {
    return this.request<{ success: boolean; subdomain?: string; port?: number; message?: string }>(
      "/api/tunnels",
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );
  }

  deleteTunnel(params: { subdomain?: string; port?: number }) {
    const qs = new URLSearchParams();
    if (params.subdomain) qs.set("subdomain", params.subdomain);
    if (params.port !== undefined) qs.set("port", String(params.port));
    return this.request<{ success: boolean; message?: string }>(`/api/tunnels?${qs.toString()}`, {
      method: "DELETE",
    });
  }

  closeTunnel(params: { subdomain?: string; port?: number }) {
    return this.request<{ success: boolean; message?: string }>("/api/tunnels/close", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  listKeys() {
    return this.request<RunPortKeyRecord[]>("/api/keys");
  }

  addKey(params: { name: string; publicKey: string }) {
    return this.request<RunPortKeyRecord & { message?: string }>("/api/keys", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  deleteKey(id: number) {
    return this.request<{ success: boolean }>(`/api/keys?id=${encodeURIComponent(String(id))}`, {
      method: "DELETE",
    });
  }

  getLogs() {
    return this.request<{ logs: RunPortLogRecord[] }>("/api/logs");
  }

  listReviews(params?: { subdomain?: string; status?: "open" | "resolved" }) {
    const qs = new URLSearchParams();
    if (params?.subdomain) qs.set("subdomain", params.subdomain);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.request<{ reviews: RunPortReviewRecord[]; total: number; hiddenCount: number }>(
      `/api/reviews${suffix}`,
    );
  }

  resolveReview(id: string) {
    return this.request<{ success: boolean }>(`/api/reviews/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "resolved" }),
    });
  }
}
