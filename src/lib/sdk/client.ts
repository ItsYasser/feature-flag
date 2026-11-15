import { compileRuleset, evaluateFlag, type CompiledRuleset } from "./evaluate";
import type { Evaluation } from "./types";

/**
 * SistemSaya feature-flag SDK. Framework-agnostic: no React, no Node-only APIs — just fetch and timers.
 *
 *   const flags = createFlagClient({ baseUrl: "https://flags.internal", env: "prod" });
 *   if (flags.isEnabled("billing.new_invoice_design", clientId, false)) { ... }
 *
 * isEnabled() never touches the network. A background loop polls the ruleset with If-None-Match;
 * a 304 costs the server one primary-key lookup, and on any error we keep serving the last good copy.
 */

export interface FlagClientOptions {
  baseUrl: string;
  env: string;
  /** Default 5000 ms in this demo; the design doc recommends 15 s in production. */
  pollIntervalMs?: number;
  /** Inject a custom fetch (tests, or the demo's "simulate outage" switch). */
  fetch?: typeof fetch;
  /** Local emergency overrides that win over everything (e.g. read from an env var at boot). */
  emergencyOverrides?: Record<string, boolean>;
  logger?: Pick<Console, "warn" | "info">;
  /** Max poll log entries kept in memory. */
  maxLogEntries?: number;
  /** Start polling immediately. Default true. */
  autoStart?: boolean;
}

export type PollStatus = 200 | 304 | "error";

export interface PollLogEntry {
  id: number;
  at: number;
  status: PollStatus;
  /** Version we hold after this poll. */
  version: number | null;
  durationMs: number;
  error?: string;
}

export interface FlagClientState {
  env: string;
  pollIntervalMs: number;
  running: boolean;
  version: number | null;
  hasRuleset: boolean;
  flagCount: number;
  /** Last time the server confirmed our copy is current (a 200 or a 304). */
  lastSuccessfulSync: number | null;
  lastError: string | null;
  consecutiveErrors: number;
  pollLog: readonly PollLogEntry[];
  emergencyOverrides: Readonly<Record<string, boolean>>;
}

export interface FlagClient {
  isEnabled(flagKey: string, clientId: string, fallback: boolean): boolean;
  /** Same as isEnabled but also says which rule produced the value. */
  evaluate(flagKey: string, clientId: string, fallback: boolean): Evaluation;
  getState(): FlagClientState;
  /** Seconds since the last successful sync (Infinity if never synced). */
  getStalenessSeconds(now?: number): number;
  setEmergencyOverride(flagKey: string, value: boolean | null): void;
  subscribe(listener: () => void): () => void;
  /** Poll right now (e.g. at boot, or a "refresh" button). Resolves when the poll finishes. */
  refresh(): Promise<void>;
  start(): void;
  stop(): void;
}

export function createFlagClient(options: FlagClientOptions): FlagClient {
  const {
    baseUrl,
    env,
    pollIntervalMs = 5000,
    logger = console,
    maxLogEntries = 40,
    autoStart = true,
  } = options;
  const doFetch: typeof fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const url = `${baseUrl.replace(/\/$/, "")}/api/v1/rulesets/${encodeURIComponent(env)}`;

  // --- mutable internals -------------------------------------------------------------------
  let ruleset: CompiledRuleset | null = null; // replaced wholesale, never mutated in place
  let etag: string | null = null;
  let emergency = new Map<string, boolean>(Object.entries(options.emergencyOverrides ?? {}));
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let logSeq = 0;
  const warnedUnknown = new Set<string>();
  const listeners = new Set<() => void>();

  let state: FlagClientState = {
    env,
    pollIntervalMs,
    running: false,
    version: null,
    hasRuleset: false,
    flagCount: 0,
    lastSuccessfulSync: null,
    lastError: null,
    consecutiveErrors: 0,
    pollLog: [],
    emergencyOverrides: Object.fromEntries(emergency),
  };

  // State is immutable snapshots so UI frameworks (useSyncExternalStore etc.) can diff by reference.
  function update(patch: Partial<FlagClientState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  }

  function log(entry: Omit<PollLogEntry, "id">) {
    const next = [{ ...entry, id: ++logSeq }, ...state.pollLog].slice(0, maxLogEntries);
    return next;
  }

  async function pollOnce(): Promise<void> {
    const started = Date.now();
    try {
      const headers: Record<string, string> = { accept: "application/json" };
      if (etag) headers["if-none-match"] = etag;
      const res = await doFetch(url, { headers, cache: "no-store" });

      if (res.status === 304) {
        // Nothing changed. Our copy is confirmed current — just record the sync.
        update({
          lastSuccessfulSync: Date.now(),
          lastError: null,
          consecutiveErrors: 0,
          pollLog: log({ at: Date.now(), status: 304, version: state.version, durationMs: Date.now() - started }),
        });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Build the complete new map first; only then swap it in with a single assignment.
      // Readers calling isEnabled() concurrently see either the old map or the new one, never a mix.
      const compiled = compileRuleset(await res.json());
      ruleset = compiled.ruleset;
      etag = res.headers.get("etag") ?? `"${compiled.version}"`;
      warnedUnknown.clear();

      update({
        version: compiled.version,
        hasRuleset: true,
        flagCount: compiled.ruleset.size,
        lastSuccessfulSync: Date.now(),
        lastError: null,
        consecutiveErrors: 0,
        pollLog: log({ at: Date.now(), status: 200, version: compiled.version, durationMs: Date.now() - started }),
      });
    } catch (err) {
      // Keep serving the last good copy. Never clear `ruleset` on failure.
      const message = err instanceof Error ? err.message : String(err);
      update({
        lastError: message,
        consecutiveErrors: state.consecutiveErrors + 1,
        pollLog: log({ at: Date.now(), status: "error", version: state.version, durationMs: Date.now() - started, error: message }),
      });
    }
  }

  function schedule() {
    if (!state.running) return;
    timer = setTimeout(async () => {
      await refresh();
      schedule();
    }, pollIntervalMs);
  }

  function refresh(): Promise<void> {
    // Never run two polls at once: a slow response must not overwrite a newer one.
    if (!inFlight) inFlight = pollOnce().finally(() => (inFlight = null));
    return inFlight;
  }

  function evaluate(flagKey: string, clientId: string, fallback: boolean): Evaluation {
    const result = evaluateFlag(ruleset, emergency, flagKey, clientId, fallback);
    if (result.fallbackReason === "unknown_flag" && !warnedUnknown.has(flagKey)) {
      warnedUnknown.add(flagKey);
      logger.warn(`[flags] unknown flag "${flagKey}" in ${env} ruleset v${state.version} — using fallback ${fallback}`);
    }
    return result;
  }

  const client: FlagClient = {
    isEnabled: (flagKey, clientId, fallback) => evaluate(flagKey, clientId, fallback).value,
    evaluate,
    getState: () => state,
    getStalenessSeconds(now = Date.now()) {
      return state.lastSuccessfulSync === null ? Infinity : Math.max(0, (now - state.lastSuccessfulSync) / 1000);
    },
    setEmergencyOverride(flagKey, value) {
      const next = new Map(emergency);
      if (value === null) next.delete(flagKey);
      else next.set(flagKey, value);
      emergency = next;
      update({ emergencyOverrides: Object.fromEntries(next) });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh,
    start() {
      if (state.running) return;
      update({ running: true });
      void refresh().then(schedule);
    },
    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
      update({ running: false });
    },
  };

  if (autoStart) client.start();
  return client;
}
