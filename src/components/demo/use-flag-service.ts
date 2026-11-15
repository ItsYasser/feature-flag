"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createFlagClient, type FlagClient, type FlagClientState } from "@/lib/sdk";
import type { Environment } from "@/lib/domain";

export const DEMO_POLL_INTERVAL_MS = 5000;
export const STALE_WARNING_SECONDS = 30;

const noopSubscribe = () => () => {};

/**
 * Runs the real SDK in the browser as if it were the Billing service.
 * "Restart" throws the client away and builds a new one — exactly what a process restart does
 * to in-memory state. Emergency overrides live outside the client, like an env var would.
 */
export function useFlagService(env: Environment) {
  const outageRef = useRef(false);
  const emergencyRef = useRef<Record<string, boolean>>({});
  const [outage, setOutageState] = useState(false);
  const [bootId, setBootId] = useState(0);
  const [client, setClient] = useState<FlagClient | null>(null);
  const [bootedAt, setBootedAt] = useState<number | null>(null);

  useEffect(() => {
    const c = createFlagClient({
      baseUrl: window.location.origin,
      env,
      pollIntervalMs: DEMO_POLL_INTERVAL_MS,
      emergencyOverrides: emergencyRef.current,
      fetch: async (input, init) => {
        if (outageRef.current) {
          await new Promise((r) => setTimeout(r, 250));
          throw new TypeError("Simulated outage: flag API unreachable");
        }
        return fetch(input, init);
      },
    });
    setClient(c);
    setBootedAt(Date.now());
    return () => c.stop();
  }, [env, bootId]);

  const state: FlagClientState | null = useSyncExternalStore(
    client?.subscribe ?? noopSubscribe,
    () => client?.getState() ?? null,
    () => null,
  );

  const setOutage = useCallback(
    (on: boolean) => {
      outageRef.current = on;
      setOutageState(on);
      void client?.refresh();
    },
    [client],
  );

  const restart = useCallback(() => {
    setClient(null);
    setBootId((n) => n + 1);
  }, []);

  const setEmergencyOverride = useCallback(
    (key: string, value: boolean | null) => {
      if (!client) return;
      client.setEmergencyOverride(key, value);
      emergencyRef.current = { ...client.getState().emergencyOverrides };
    },
    [client],
  );

  return { client, state, outage, setOutage, restart, bootId, bootedAt, setEmergencyOverride };
}

export type FlagService = ReturnType<typeof useFlagService>;

/** Re-render every second so staleness counters tick. */
export function useNow(intervalMs = 1000): number {
  // Starts at 0 (not Date.now()) so the prerendered HTML is deterministic; the effect fills it in.
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
