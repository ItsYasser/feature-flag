import { getActor } from "@/server/auth";
import { getFlag, updateFlagMeta } from "@/server/flags";
import { handle, json, readJson } from "@/server/http";
import { flagKeySchema, parse, patchFlagBody } from "@/server/validation";

type Ctx = { params: Promise<{ key: string }> };

/** GET /api/v1/flags/{key} */
export const GET = handle<Ctx>(async (_req, ctx, backend) => {
  const key = parse(flagKeySchema, (await ctx.params).key, "flag key");
  return json({ flag: await getFlag(backend, key) });
});

/** PATCH /api/v1/flags/{key} — description, expiresAt, ownerTeam. The key itself is immutable. */
export const PATCH = handle<Ctx>(async (req, ctx, backend) => {
  const key = parse(flagKeySchema, (await ctx.params).key, "flag key");
  const actor = getActor(req.headers);
  const body = parse(patchFlagBody, await readJson(req), "request body");
  return json(await updateFlagMeta(backend, actor, key, body));
});
