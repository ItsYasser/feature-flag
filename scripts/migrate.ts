import "dotenv/config";
import { createBackend, isPgliteUrl, MIGRATIONS_FOLDER } from "../src/db";

async function main() {
  const url = process.env.DATABASE_URL;
  if (isPgliteUrl(url)) {
    // The embedded database migrates itself when the backend is created.
    process.env.FF_SKIP_AUTOSEED = "1";
    const backend = await createBackend(url);
    await backend.close();
    console.log("✓ Migrated embedded PGlite database");
    return;
  }

  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
  if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = (await import("ws")).default;

  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("✓ Migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ Migration failed:", err);
  process.exit(1);
});
