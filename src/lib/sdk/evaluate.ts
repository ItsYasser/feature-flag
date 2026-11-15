import type { Evaluation } from "./types";

/** In-memory form of a ruleset. Built once per 200 response, then swapped in with one assignment. */
export interface CompiledFlag {
  default: boolean;
  overrides: ReadonlyMap<string, boolean>;
}
export type CompiledRuleset = ReadonlyMap<string, CompiledFlag>;

/**
 * The single source of truth for evaluation order, shared by the SDK and the /evaluate endpoint:
 *   1. local emergency override (set on the service itself, wins over everything)
 *   2. per-client override for this environment
 *   3. environment default
 *   4. the fallback passed in code at the call site
 */
export function evaluateFlag(
  ruleset: CompiledRuleset | null,
  emergency: ReadonlyMap<string, boolean>,
  flagKey: string,
  clientId: string,
  fallback: boolean,
): Evaluation {
  const emergencyValue = emergency.get(flagKey);
  if (emergencyValue !== undefined) return { value: emergencyValue, source: "emergency_override" };

  if (!ruleset) return { value: fallback, source: "fallback", fallbackReason: "no_ruleset" };

  const flag = ruleset.get(flagKey);
  if (!flag) return { value: fallback, source: "fallback", fallbackReason: "unknown_flag" };

  const override = flag.overrides.get(clientId);
  if (override !== undefined) return { value: override, source: "client_override" };

  return { value: flag.default, source: "env_default" };
}

/**
 * Validate a ruleset payload and build the lookup maps. Throws on a malformed payload so the
 * caller keeps its last good copy instead of swapping in garbage.
 */
export function compileRuleset(payload: unknown): { version: number; ruleset: CompiledRuleset } {
  if (!payload || typeof payload !== "object") throw new Error("ruleset payload is not an object");
  const { version, flags } = payload as { version?: unknown; flags?: unknown };
  if (typeof version !== "number" || !Number.isFinite(version)) {
    throw new Error("ruleset payload has no numeric version");
  }
  if (!flags || typeof flags !== "object") throw new Error("ruleset payload has no flags object");

  const next = new Map<string, CompiledFlag>();
  for (const [key, raw] of Object.entries(flags as Record<string, unknown>)) {
    const def = (raw as { default?: unknown })?.default;
    const overrides = (raw as { overrides?: unknown })?.overrides ?? {};
    if (typeof def !== "boolean" || typeof overrides !== "object" || overrides === null) {
      throw new Error(`ruleset entry for ${key} is malformed`);
    }
    const map = new Map<string, boolean>();
    for (const [clientId, value] of Object.entries(overrides as Record<string, unknown>)) {
      if (typeof value !== "boolean") throw new Error(`override ${key}/${clientId} is not boolean`);
      map.set(clientId, value);
    }
    next.set(key, { default: def, overrides: map });
  }
  return { version, ruleset: next };
}
