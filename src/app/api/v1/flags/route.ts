import { getActor } from "@/server/auth";
import { createFlag, listFlags } from "@/server/flags";
import { handle, json, readJson, searchParams } from "@/server/http";
import { createFlagBody, listQuery, parse } from "@/server/validation";

/** GET /api/v1/flags?status=active|archived|all */
export const GET = handle(async (req, _ctx, backend) => {
  const { status } = parse(listQuery, searchParams(req), "query string");
  return json({ flags: await listFlags(backend, status) });
});

/** POST /api/v1/flags — create a flag owned by the acting team. */
export const POST = handle(async (req, _ctx, backend) => {
  const actor = getActor(req.headers);
  const body = parse(createFlagBody, await readJson(req), "request body");
  const result = await createFlag(backend, actor, body);
  return json(result, { status: 201 });
});
