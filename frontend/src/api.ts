import type { Answers, BatchResponse, Result, Schema, Summary } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
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
    throw new ApiError(message, fieldErrors);
  }
  if (res.status === 204) return undefined as T;
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return res.json();
  if (type.startsWith("text/plain")) return (await res.text()) as T;
  return (await res.blob()) as T;
}

const json = (answers: Answers, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ answers }),
});

export const api = {
  schema: () => request<Schema>("/api/schema"),
  assess: (answers: Answers, signal?: AbortSignal) => request<Result>("/api/assess", { ...json(answers), signal }),
  textReport: (answers: Answers) => request<string>("/api/report/text", json(answers)),
  pdf: (answers: Answers) => request<Blob>("/api/report/pdf", json(answers)),
  xlsx: (answers: Answers) => request<Blob>("/api/report/xlsx", json(answers)),
  list: () => request<Summary[]>("/api/assessments"),
  get: (id: number) => request<{ id: number; answers: Answers; result: Result }>(`/api/assessments/${id}`),
  create: (answers: Answers) => request<{ id: number; summary: Summary }>("/api/assessments", json(answers)),
  update: (id: number, answers: Answers) =>
    request<{ id: number; summary: Summary }>(`/api/assessments/${id}`, json(answers, "PUT")),
  remove: (id: number) => request<void>(`/api/assessments/${id}`, { method: "DELETE" }),
  portfolioXlsx: () => request<Blob>("/api/portfolio/export.xlsx"),
  batchTemplate: () => request<Blob>("/api/batch/template.xlsx"),
  batch: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<BatchResponse>("/api/batch", { method: "POST", body: form });
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
