import type { RulesetPayload } from "@/lib/sdk/types";

export interface RulesetDeps {
  /** Cheap: a single primary-key lookup of the version number. */
  getVersion(): Promise<number>;
  /** Expensive: the full ruleset for the environment (contains its own version). */
  getRuleset(): Promise<RulesetPayload>;
}

export const etagFor = (version: number) => `"${version}"`;

/** Does an If-None-Match header match this ETag? Handles lists, weak validators and `*`. */
export function ifNoneMatchMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header
    .split(",")
    .map((t) => t.trim())
    .some((t) => t === "*" || t.replace(/^W\//, "") === etag);
}

const BASE_HEADERS = {
  // Never let a CDN or browser cache answer for us — freshness is decided by the version check.
  "cache-control": "no-store",
  vary: "If-None-Match",
};

/**
 * GET /api/v1/rulesets/{env}
 *  - If-None-Match matches the current version → 304, empty body, and we never load the ruleset.
 *  - Otherwise → 200 with the full ruleset and ETag = its version.
 */
export async function rulesetResponse(ifNoneMatch: string | null, deps: RulesetDeps): Promise<Response> {
  if (ifNoneMatch) {
    const version = await deps.getVersion();
    const etag = etagFor(version);
    if (ifNoneMatchMatches(ifNoneMatch, etag)) {
      return new Response(null, { status: 304, headers: { ...BASE_HEADERS, etag } });
    }
  }
  const ruleset = await deps.getRuleset();
  return new Response(JSON.stringify(ruleset), {
    status: 200,
    headers: {
      ...BASE_HEADERS,
      etag: etagFor(ruleset.version),
      "content-type": "application/json; charset=utf-8",
    },
  });
}
