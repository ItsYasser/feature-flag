import { unstable_rethrow } from "next/navigation";
import { getBackend, type Backend } from "@/db";
import { ApiError, badRequest } from "./errors";

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
  }
  console.error("[api] unexpected error", err);
  // Database drivers wrap the real reason (e.g. `relation "flags" does not exist`) in `cause`.
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : null;
  const message = cause ?? (err instanceof Error ? err.message : "Unexpected error");
  const hint = /relation .* does not exist/i.test(message)
    ? " — the database has no tables yet. Run `npm run db:migrate` and `npm run db:seed` against this DATABASE_URL."
    : "";
  return json({ error: { code: "internal_error", message: message + hint } }, { status: 500 });
}

/** Wrap a handler: inject the DB backend and turn thrown ApiErrors into JSON error responses. */
export function handle<Ctx>(fn: (req: Request, ctx: Ctx, backend: Backend) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      // Touch the request first: under Cache Components this makes the build skip prerendering
      // API routes before any database connection is attempted.
      void req.url;
      const backend = await getBackend();
      return await fn(req, ctx, backend);
    } catch (err) {
      // Let Next.js's own control-flow signals (e.g. "bail out of prerendering") through untouched.
      unstable_rethrow(err);
      return errorResponse(err);
    }
  };
}

/** Read a JSON body. Empty bodies become {} so optional-body endpoints (DELETE) work. */
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest("Request body is not valid JSON.");
  }
}

export function searchParams(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.url).searchParams.entries());
}
