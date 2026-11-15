import { compileRuleset, evaluateFlag } from "@/lib/sdk/evaluate";
import { getRuleset } from "@/server/flags";
import { handle, json, searchParams } from "@/server/http";
import { evaluateQuery, parse } from "@/server/validation";

/** GET /api/v1/evaluate?flag=&client=&env= — a debugging aid. Real services evaluate locally via the SDK. */
export const GET = handle(async (req, _ctx, backend) => {
  const { flag, client, env } = parse(evaluateQuery, searchParams(req), "query string");
  const { version, ruleset } = compileRuleset(await getRuleset(backend, env));
  const result = evaluateFlag(ruleset, new Map(), flag, client, false);
  return json({
    flag,
    client,
    env,
    version,
    enabled: result.value,
    source: result.source,
    ...(result.fallbackReason
      ? { note: `${flag} is not in the ${env} ruleset (unknown or archived) — returned fallback false` }
      : {}),
  });
});
