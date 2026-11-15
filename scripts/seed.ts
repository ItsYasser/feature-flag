import "dotenv/config";
import { createBackend } from "../src/db";
import { seedDatabase } from "../src/db/seed";
import { getRulesetVersion, listFlags } from "../src/server/flags";

async function main() {
  process.env.FF_SKIP_AUTOSEED = "1";
  const backend = await createBackend(process.env.DATABASE_URL);
  try {
    await seedDatabase(backend);
    const flags = await listFlags(backend);
    console.log(`✓ Seeded ${flags.length} flags on ${backend.kind}:`);
    for (const f of flags) {
      const prod = f.environments.prod;
      const overrides = prod.overrides.map((o) => `${o.clientId}=${o.enabled ? "ON" : "OFF"}`).join(", ");
      console.log(`  • ${f.key.padEnd(28)} prod default ${prod.default ? "ON " : "OFF"}  ${overrides}`);
    }
    for (const env of ["dev", "staging", "prod"] as const) {
      console.log(`  ruleset_version[${env}] = ${await getRulesetVersion(backend, env)}`);
    }
  } finally {
    await backend.close();
  }
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exit(1);
});
