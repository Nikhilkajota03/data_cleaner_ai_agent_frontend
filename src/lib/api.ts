import type {
  ApproveResponse,
  Client,
  ClientDetail,
  CrmStats,
  ExecutionDetail,
  ExecutionSummary,
  Health,
  Invoice,
  LoginResponse,
  PendingApproval,
  PipelineRunResponse,
  PurgeResponse,
  RetentionStats,
  RollbackResponse,
  SeedResponse,
  UserOut,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "compliance_admin_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearAuthToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Cannot reach the backend. Is the API running on " + API_URL + "?");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail =
        typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};

const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  health: () => request<Health>("/health"),

  // Authentication
  login: (username: string, password: string) =>
    post<LoginResponse>("/api/auth/login", { username, password }),
  me: () => request<UserOut>("/api/auth/me"),

  runPipeline: (user_prompt: string, user_id = "analyst@enterprise.local") =>
    post<PipelineRunResponse>("/api/pipeline/run", {
      user_prompt,
      user_id,
      wait_for_pause: false,
    }),
  pending: (threadId: string) => request<PendingApproval>(`/api/pipeline/${threadId}/pending`),
  approve: (thread_id: string, approval_token: string, approver_id: string) =>
    post<ApproveResponse>("/api/pipeline/approve", { thread_id, approval_token, approver_id }),
  reject: (thread_id: string, rejection_reason: string, rejected_by: string) =>
    post<{ status: string; message?: string }>("/api/pipeline/reject", {
      thread_id,
      rejection_reason,
      rejected_by,
    }),
  rollback: (executionId: string, reason: string) =>
    post<RollbackResponse>(`/api/pipeline/${executionId}/rollback`, { reason }),

  clients: (p: { skip?: number; limit?: number; include_deleted?: boolean; search?: string }) =>
    request<Client[]>(`/api/crm/clients${qs(p)}`),
  client: (id: string) => request<ClientDetail>(`/api/crm/clients/${id}`),
  invoices: (p: { skip?: number; limit?: number; client_id?: string; include_deleted?: boolean }) =>
    request<Invoice[]>(`/api/crm/invoices${qs(p)}`),

  crmStats: () => request<CrmStats>("/api/audit/crm-stats"),
  retentionStats: (days = 30) => request<RetentionStats>(`/api/audit/retention-stats${qs({ retention_days: days })}`),
  executions: () => request<ExecutionSummary[]>("/api/audit/executions"),
  execution: (id: string) => request<ExecutionDetail>(`/api/audit/executions/${id}`),

  purge: (retention_days: number) => post<PurgeResponse>("/api/admin/purge", { retention_days }),
  hardDelete: (id: string) =>
    request<Record<string, unknown>>(`/api/admin/clients/${id}/hard-delete`, { method: "DELETE" }),
  seed: () => post<SeedResponse>("/api/admin/seed-demo-data"),
};

export function streamUrl(threadId: string, timeout = 120) {
  return `${API_URL}/api/pipeline/${threadId}/stream?timeout=${timeout}`;
}
