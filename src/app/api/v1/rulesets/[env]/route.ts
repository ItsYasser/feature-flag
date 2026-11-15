import { getRuleset, getRulesetVersion } from "@/server/flags";
import { handle } from "@/server/http";
import { rulesetResponse } from "@/server/ruleset-http";
import { envSchema, parse } from "@/server/validation";

type Ctx = { params: Promise<{ env: string }> };

/**
 * GET /api/v1/rulesets/{env} — what services poll.
 * ETag = ruleset version. A matching If-None-Match costs one primary-key lookup and returns 304.
 */
export const GET = handle<Ctx>(async (req, ctx, backend) => {
  const env = parse(envSchema, (await ctx.params).env, "environment");
  return rulesetResponse(req.headers.get("if-none-match"), {
    getVersion: () => getRulesetVersion(backend, env),
    getRuleset: () => getRuleset(backend, env),
  });
});
