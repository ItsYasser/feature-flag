"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { USERS, type DemoUser, type Environment } from "@/lib/domain";
import { api, type AuditView, type FlagView, type WriteResult } from "./api";
import type { GuideStep } from "./demo-guide";
import { useFlagService, useNow, type FlagService } from "./use-flag-service";

const AUDIT_POLL_MS = 2000;

interface Pending {
  toastId: string | number;
  label: string;
  version: number;
  env: Environment;
  savedAt: number;
}

export interface DemoContextValue {
  actor: DemoUser;
  setActor(user: DemoUser): void;
  env: Environment;
  setEnv(env: Environment): void;
  flags: FlagView[] | null;
  flagsError: string | null;
  audit: AuditView[] | null;
  reloadFlags(): void;
  service: FlagService;
  now: number;
  done: ReadonlySet<GuideStep>;
  mark(step: GuideStep): void;
  /** Call after every successful write: refreshes data and tracks the change until the service has it. */
  onWritten(result: WriteResult, label: string): void;
  hoveredClient: string | null;
  setHoveredClient(id: string | null): void;
  selectedFlag: string | null;
  setSelectedFlag(key: string | null): void;
  selectedClient: string;
  setSelectedClient(id: string): void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo() must be used inside <DemoProvider>");
  return ctx;
}

/**
 * Everything the demo pages share, kept above the routes so that moving between
 * Dashboard / Flags / Clients / Services / Audit keeps the same SDK client, identity,
 * environment and in-flight notifications — just like one long-running service would.
 */
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [actor, setActor] = useState<DemoUser>(USERS[0]);
  const [env, setEnvState] = useState<Environment>("prod");
  const [flags, setFlags] = useState<FlagView[] | null>(null);
  const [flagsError, setFlagsError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditView[] | null>(null);
  const [hoveredClient, setHoveredClient] = useState<string | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>("client_A");
  const [done, setDone] = useState<ReadonlySet<GuideStep>>(new Set());
  const lastAuditId = useRef<number | null>(null);
  const pending = useRef<Pending | null>(null);

  const service = useFlagService(env);
  const now = useNow();
  const { client } = service;

  const mark = useCallback((step: GuideStep) => {
    setDone((prev) => (prev.has(step) ? prev : new Set(prev).add(step)));
  }, []);

  const loadFlags = useCallback(async () => {
    try {
      setFlags(await api.listFlags());
      setFlagsError(null);
    } catch (err) {
      setFlagsError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const entries = await api.audit(100);
      setAudit(entries);
      const top = entries[0]?.id ?? null;
      if (top !== lastAuditId.current) {
        lastAuditId.current = top;
        void loadFlags(); // someone wrote something (maybe in another tab)
      }
    } catch {
      /* best-effort feed */
    }
  }, [loadFlags]);

  useEffect(() => {
    const first = setTimeout(() => {
      void loadFlags();
      void loadAudit();
    }, 0);
    const id = setInterval(loadAudit, AUDIT_POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [loadFlags, loadAudit]);

  // Watch the SDK: tick guide steps and confirm "your change is live".
  useEffect(() => {
    if (!client) return;
    return client.subscribe(() => {
      const s = client.getState();
      if (s.pollLog.some((e) => e.status === 304)) mark("polls");
      if (!s.hasRuleset && s.pollLog[0]?.status === "error") mark("restart");
      if (Object.keys(s.emergencyOverrides).length > 0) mark("emergency");

      const p = pending.current;
      if (p && s.env === p.env && s.version !== null && s.version >= p.version) {
        const secs = ((Date.now() - p.savedAt) / 1000).toFixed(1);
        toast.success(p.label, {
          id: p.toastId,
          description: `Live in billing-service ${secs}s after saving (ruleset v${s.version}).`,
          duration: 5000,
        });
        pending.current = null;
      }
    });
  }, [client, mark]);

  const onWritten = useCallback(
    (result: WriteResult, label: string) => {
      void loadFlags();
      void loadAudit();
      if (!result.changed) {
        toast.info("Nothing to change", { description: "The flag was already in that state — nothing was written." });
        return;
      }
      mark("flip");
      const version = result.versions[env];
      if (version === undefined) {
        toast.success(label, { description: "Saved. This change doesn't affect the environment the service runs in." });
        return;
      }
      if (pending.current) toast.dismiss(pending.current.toastId);
      const toastId = toast.loading(label, {
        description: service.outage
          ? `Saved as v${version}. The service can't reach the flag API right now, so it keeps serving its last copy.`
          : `Saved as v${version}. billing-service picks it up on its next poll (≤ 5s)…`,
      });
      pending.current = { toastId, label, version, env, savedAt: Date.now() };
    },
    [env, loadFlags, loadAudit, mark, service.outage],
  );

  const setEnv = useCallback((next: Environment) => {
    if (pending.current) toast.dismiss(pending.current.toastId);
    pending.current = null;
    setEnvState(next);
  }, []);

  const value = useMemo<DemoContextValue>(
    () => ({
      actor,
      setActor,
      env,
      setEnv,
      flags,
      flagsError,
      audit,
      reloadFlags: () => void loadFlags(),
      service,
      now,
      done,
      mark,
      onWritten,
      hoveredClient,
      setHoveredClient,
      selectedFlag,
      setSelectedFlag,
      selectedClient,
      setSelectedClient,
    }),
    [actor, env, setEnv, flags, flagsError, audit, loadFlags, service, now, done, mark, onWritten, hoveredClient, selectedFlag, selectedClient],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
