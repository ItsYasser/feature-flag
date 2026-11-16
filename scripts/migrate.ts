import "dotenv/config";
import { createBackend, isPgliteUrl, MIGRATIONS_FOLDER } from "../src/db";

/**
 * Apply migrations to the database in DATABASE_URL.
 *
 *   npm run db:migrate                  migrate only
 *   tsx scripts/migrate.ts --seed-if-empty
 *                                       migrate, then add the demo data if there are no flags yet.
 *                                       Used by `vercel-build`, so a fresh Neon database is ready
 *                                       after the first deploy without copying secrets anywhere.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  const seedIfEmpty = process.argv.includes("--seed-if-empty");

  if (isPgliteUrl(url)) {
    if (process.env.VERCEL) {
      throw new Error(
        "DATABASE_URL is not available to this Vercel build. Connect the Neon database to this project for this environment (Storage → Neon), then redeploy.",
      );
    }
    // The embedded database migrates itself when the backend is created.
    process.env.FF_SKIP_AUTOSEED = "1";
    const backend = await createBackend(url);
    await backend.close();
    console.log("✓ Migrated the EMBEDDED local database (./.data/pglite) — DATABASE_URL is not set.");
    console.log("  To migrate Neon, put DATABASE_URL in .env first.");
    return;
  }

  const host = new URL(url!).host;
  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
  if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = (await import("ws")).default;

  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
    console.log(`✓ Migrations applied to ${host}`);
  } finally {
    await pool.end();
  }

  if (seedIfEmpty) {
    const { sql } = await import("drizzle-orm");
    const { seedDatabase } = await import("../src/db/seed");
    const backend = await createBackend(url);
    try {
      const result = await backend.read.execute(sql`SELECT count(*)::int AS n FROM flags`);
      const rows = (Array.isArray(result) ? result : (result as unknown as { rows: { n: number }[] }).rows) as { n: number }[];
      if (Number(rows[0]?.n ?? 0) === 0) {
        await seedDatabase(backend);
        console.log(`✓ Database was empty, so demo data was added to ${host}`);
      } else {
        console.log(`✓ ${rows[0].n} flags already exist on ${host}; demo data left untouched`);
      }
    } finally {
      await backend.close();
    }
  }
}

main().catch((err) => {
  console.error("✗ Migration failed:", err);
  process.exit(1);
});
