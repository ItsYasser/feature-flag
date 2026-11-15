import { listAudit } from "@/server/flags";
import { handle, json, searchParams } from "@/server/http";
import { auditQuery, flagKeySchema, parse } from "@/server/validation";

type Ctx = { params: Promise<{ key: string }> };

/** GET /api/v1/flags/{key}/audit?limit=&env= */
export const GET = handle<Ctx>(async (req, ctx, backend) => {
  const key = parse(flagKeySchema, (await ctx.params).key, "flag key");
  const { limit, env } = parse(auditQuery, searchParams(req), "query string");
  return json({ entries: await listAudit(backend, { flagKey: key, env, limit }) });
});
