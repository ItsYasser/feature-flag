import { getActor } from "@/server/auth";
import { deleteOverride, setOverride } from "@/server/flags";
import { handle, json, readJson, searchParams } from "@/server/http";
import {
  clientIdSchema,
  envSchema,
  flagKeySchema,
  parse,
  reasonOnlyBody,
  toggleBody,
} from "@/server/validation";

type Ctx = { params: Promise<{ key: string; env: string; clientId: string }> };

async function target(ctx: Ctx) {
  const params = await ctx.params;
  return {
    key: parse(flagKeySchema, params.key, "flag key"),
    env: parse(envSchema, params.env, "environment"),
    clientId: parse(clientIdSchema, params.clientId, "client id"),
  };
}

/** PUT /api/v1/flags/{key}/env/{env}/clients/{clientId}  { enabled, reason } */
export const PUT = handle<Ctx>(async (req, ctx, backend) => {
  const { key, env, clientId } = await target(ctx);
  const actor = getActor(req.headers);
  const { enabled, reason } = parse(toggleBody, await readJson(req), "request body");
  return json(await setOverride(backend, actor, key, env, clientId, enabled, reason));
});

/** DELETE /api/v1/flags/{key}/env/{env}/clients/{clientId}  { reason } — the client goes back to the default. */
export const DELETE = handle<Ctx>(async (req, ctx, backend) => {
  const { key, env, clientId } = await target(ctx);
  const actor = getActor(req.headers);
  // Some HTTP clients can't send a DELETE body, so ?reason= is accepted too.
  const body = (await readJson(req)) as Record<string, unknown>;
  const { reason } = parse(reasonOnlyBody, { ...searchParams(req), ...body }, "request body");
  return json(await deleteOverride(backend, actor, key, env, clientId, reason));
});
