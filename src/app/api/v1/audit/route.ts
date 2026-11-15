import { listAudit } from "@/server/flags";
import { handle, json, searchParams } from "@/server/http";
import { auditQuery, parse } from "@/server/validation";

/** GET /api/v1/audit?limit=&env= — latest entries across all flags. */
export const GET = handle(async (req, _ctx, backend) => {
  const { limit, env } = parse(auditQuery, searchParams(req), "query string");
  return json({ entries: await listAudit(backend, { env, limit }) });
});
