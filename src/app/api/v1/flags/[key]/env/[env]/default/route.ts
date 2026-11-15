import { getActor } from "@/server/auth";
import { setDefault } from "@/server/flags";
import { handle, json, readJson } from "@/server/http";
import { envSchema, flagKeySchema, parse, toggleBody } from "@/server/validation";

type Ctx = { params: Promise<{ key: string; env: string }> };

/** PUT /api/v1/flags/{key}/env/{env}/default  { enabled, reason } */
export const PUT = handle<Ctx>(async (req, ctx, backend) => {
  const params = await ctx.params;
  const key = parse(flagKeySchema, params.key, "flag key");
  const env = parse(envSchema, params.env, "environment");
  const actor = getActor(req.headers);
  const { enabled, reason } = parse(toggleBody, await readJson(req), "request body");
  return json(await setDefault(backend, actor, key, env, enabled, reason));
});
