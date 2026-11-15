import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Two ways to reach Postgres:
 *  - neon:   Neon serverless driver. Reads go over HTTP (one round trip, no connection to manage —
 *            ideal for the hot 304 path). Writes use a short-lived WebSocket Pool because they need
 *            an interactive transaction.
 *  - pglite: embedded Postgres (WASM) for zero-setup local runs and tests. Used when DATABASE_URL is
 *            unset or starts with `pglite:`. Never used on Vercel.
 */
export interface Backend {
  kind: "neon" | "pglite";
  read: Db;
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

const g = globalThis as unknown as { __ffBackend?: Promise<Backend> };

export function getBackend(): Promise<Backend> {
  if (!g.__ffBackend) {
    g.__ffBackend = createBackend(process.env.DATABASE_URL).catch((err) => {
      g.__ffBackend = undefined;
      throw err;
    });
  }
  return g.__ffBackend;
}

/** Test helper: drop the cached backend so the next getBackend() builds a fresh one. */
export async function resetBackend(): Promise<void> {
  const current = g.__ffBackend;
  g.__ffBackend = undefined;
  if (current) await (await current).close().catch(() => {});
}

export function isPgliteUrl(url: string | undefined): boolean {
  return !url || url.startsWith("pglite:");
}

export async function createBackend(url: string | undefined): Promise<Backend> {
  if (isPgliteUrl(url)) {
    if (process.env.VERCEL) {
      throw new Error(
        "DATABASE_URL is not set. Add the Neon integration from the Vercel Marketplace (it sets DATABASE_URL) and redeploy.",
      );
    }
    return createPgliteBackend(url);
  }
  return createNeonBackend(url!);
}

async function createNeonBackend(url: string): Promise<Backend> {
  const { neon, neonConfig, Pool } = await import("@neondatabase/serverless");
  const { drizzle: drizzleHttp } = await import("drizzle-orm/neon-http");
  const { drizzle: drizzleWs } = await import("drizzle-orm/neon-serverless");
  if (typeof WebSocket === "undefined") {
    const ws = (await import("ws")).default;
    neonConfig.webSocketConstructor = ws;
  }

  const read = drizzleHttp(neon(url), { schema }) as unknown as Db;

  return {
    kind: "neon",
    read,
    async transaction(fn) {
      // A Pool per transaction: serverless functions can freeze between invocations, so we never
      // keep a WebSocket open across requests.
      const pool = new Pool({ connectionString: url });
      try {
        const db = drizzleWs(pool, { schema }) as unknown as Db;
        return await db.transaction(fn);
      } finally {
        await pool.end();
      }
    },
    async close() {},
  };
}

async function createPgliteBackend(url: string | undefined): Promise<Backend> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const { seedDatabase } = await import("./seed");

  const target = url?.replace(/^pglite:(\/\/)?/, "") || "./.data/pglite";
  if (target !== "memory") (await import("node:fs")).mkdirSync(path.resolve(/*turbopackIgnore: true*/ target), { recursive: true });
  const client = target === "memory" ? new PGlite() : new PGlite(path.resolve(/*turbopackIgnore: true*/ target));
  const db = drizzle(client, { schema }) as unknown as Db;

  let queue: Promise<unknown> = Promise.resolve();
  const backend: Backend = {
    kind: "pglite",
    read: db,
    // PGlite is single-connection: serialise transactions so concurrent requests don't interleave.
    transaction(fn) {
      const run = queue.then(() => db.transaction(fn));
      queue = run.catch(() => {});
      return run;
    },
    async close() {
      await client.close();
    },
  };

  await migrate(db as never, { migrationsFolder: MIGRATIONS_FOLDER });
  const existing = await db.select({ id: schema.flags.id }).from(schema.flags).limit(1);
  if (existing.length === 0 && process.env.FF_SKIP_AUTOSEED !== "1") {
    await seedDatabase(backend);
  }
  return backend;
}
