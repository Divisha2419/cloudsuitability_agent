import type { Answers, ProjectSummary, Result, Schema } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

// Admin session token, kept for the browser tab so a page refresh stays logged in.
const TOKEN_KEY = "cloudsuit-admin-token";

export const adminToken = {
  get(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable: the login lasts until the page is reloaded */
    }
  },
};

async function request<T>(path: string, init: RequestInit = {}, admin = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (admin) headers.set("Authorization", `Bearer ${adminToken.get() ?? ""}`);
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    let fieldErrors: Record<string, string> = {};
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (body.detail?.message) {
        message = body.detail.message;
        fieldErrors = body.detail.errors ?? {};
      }
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, res.status, fieldErrors);
  }
  if (res.status === 204) return undefined as T;
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return res.json();
  if (type.startsWith("text/plain")) return (await res.text()) as T;
  return (await res.blob()) as T;
}

const json = (body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const q = (project: string) => `project=${encodeURIComponent(project)}`;

export const api = {
  schema: () => request<Schema>("/api/schema"),
  assess: (answers: Answers, signal?: AbortSignal) => request<Result>("/api/assess", { ...json({ answers }), signal }),
  textReport: (answers: Answers) => request<string>("/api/report/text", json({ answers })),
  pdf: (answers: Answers) => request<Blob>("/api/report/pdf", json({ answers })),
  xlsx: (answers: Answers) => request<Blob>("/api/report/xlsx", json({ answers })),
  /** Save a completed assessment (replaces an earlier one with the same project + Application ID). */
  submit: (answers: Answers) => request<{ id: number; result: Result }>("/api/assessments", json({ answers })),

  admin: {
    login: (username: string, password: string) => request<{ token: string }>("/api/admin/login", json({ username, password })),
    logout: () => request<void>("/api/admin/logout", { method: "POST" }, true),
    projects: () => request<{ name: string; count: number }[]>("/api/admin/projects", {}, true),
    project: (project: string) => request<ProjectSummary>(`/api/admin/assessments?${q(project)}`, {}, true),
    get: (id: number) => request<{ id: number; answers: Answers; result: Result }>(`/api/admin/assessments/${id}`, {}, true),
    remove: (id: number) => request<void>(`/api/admin/assessments/${id}`, { method: "DELETE" }, true),
    exportXlsx: (project: string) => request<Blob>(`/api/admin/export.xlsx?${q(project)}`, {}, true),
  },
};

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") || "application";
