import { getActor } from "@/server/auth";
import { archiveFlag } from "@/server/flags";
import { handle, json, readJson } from "@/server/http";
import { flagKeySchema, parse, reasonOnlyBody } from "@/server/validation";

type Ctx = { params: Promise<{ key: string }> };

/** POST /api/v1/flags/{key}/archive  { reason } — removes the flag from every ruleset. */
export const POST = handle<Ctx>(async (req, ctx, backend) => {
  const key = parse(flagKeySchema, (await ctx.params).key, "flag key");
  const actor = getActor(req.headers);
  const { reason } = parse(reasonOnlyBody, await readJson(req), "request body");
  return json(await archiveFlag(backend, actor, key, reason));
});
