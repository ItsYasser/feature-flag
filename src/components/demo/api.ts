"use client";

import { ACTOR_HEADER, TEAM_HEADER, type DemoUser, type Environment } from "@/lib/domain";
import type { AuditView, FlagView, WriteResult } from "@/server/flags";

export type { AuditView, FlagView, WriteResult };

export class AdminApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { actor?: DemoUser } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (init.actor) {
    headers.set(ACTOR_HEADER, init.actor.id);
    headers.set(TEAM_HEADER, init.actor.team);
  }
  const res = await fetch(path, { ...init, headers, cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new AdminApiError(
      res.status,
      body?.error?.code ?? "http_error",
      body?.error?.message ?? `Request failed with HTTP ${res.status}`,
    );
  }
  return body as T;
}

const flagPath = (key: string) => `/api/v1/flags/${encodeURIComponent(key)}`;

export const api = {
  listFlags: () => request<{ flags: FlagView[] }>("/api/v1/flags").then((r) => r.flags),
  audit: (limit = 30) => request<{ entries: AuditView[] }>(`/api/v1/audit?limit=${limit}`).then((r) => r.entries),

  createFlag: (actor: DemoUser, body: { key: string; description: string; reason?: string }) =>
    request<WriteResult>("/api/v1/flags", { method: "POST", actor, body: JSON.stringify(body) }),

  archive: (actor: DemoUser, key: string, reason: string) =>
    request<WriteResult>(`${flagPath(key)}/archive`, { method: "POST", actor, body: JSON.stringify({ reason }) }),

  setDefault: (actor: DemoUser, key: string, env: Environment, enabled: boolean, reason: string) =>
    request<WriteResult>(`${flagPath(key)}/env/${env}/default`, {
      method: "PUT",
      actor,
      body: JSON.stringify({ enabled, reason }),
    }),

  setOverride: (actor: DemoUser, key: string, env: Environment, clientId: string, enabled: boolean, reason: string) =>
    request<WriteResult>(`${flagPath(key)}/env/${env}/clients/${encodeURIComponent(clientId)}`, {
      method: "PUT",
      actor,
      body: JSON.stringify({ enabled, reason }),
    }),

  deleteOverride: (actor: DemoUser, key: string, env: Environment, clientId: string, reason: string) =>
    request<WriteResult>(`${flagPath(key)}/env/${env}/clients/${encodeURIComponent(clientId)}`, {
      method: "DELETE",
      actor,
      body: JSON.stringify({ reason }),
    }),
};
