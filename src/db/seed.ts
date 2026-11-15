import { sql } from "drizzle-orm";
import type { Backend } from "./index";
import { createFlag, setOverride } from "@/server/flags";
import type { Actor } from "@/server/auth";

const billing: Actor = { user: "aisyah", team: "billing" };
const frontend: Actor = { user: "budi", team: "frontend" };

/**
 * Reset flag data to the demo starting point. Goes through the real write path, so the seed
 * itself shows up in the audit log and bumps ruleset versions like any other change.
 *
 * ruleset_version is deliberately NOT reset: versions only ever go up, so a service holding an
 * ETag from before the reseed is guaranteed to see a 200 rather than a false 304.
 */
export async function seedDatabase(backend: Backend): Promise<void> {
  // TRUNCATE is not blocked by the append-only row trigger; it's the one deliberate escape hatch,
  // used only by this seed script to reset a demo database.
  await backend.transaction(async (tx) => {
    await tx.execute(
      sql`TRUNCATE audit_log, flag_overrides, flag_defaults, flags RESTART IDENTITY CASCADE`,
    );
    await tx.execute(sql`
      INSERT INTO ruleset_version (environment, version)
      VALUES ('dev', 0), ('staging', 0), ('prod', 0)
      ON CONFLICT (environment) DO NOTHING
    `);
  });

  const inSixMonths = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString();

  await createFlag(backend, billing, {
    key: "billing.new_invoice_design",
    description: "Redesigned invoice layout with itemised tax breakdown and a pay-now button.",
    expiresAt: inSixMonths,
    defaults: { dev: true, staging: true, prod: false },
    reason: "Seed: new invoice design rollout",
  });
  await createFlag(backend, frontend, {
    key: "frontend.dark_mode",
    description: "Dark theme for the customer dashboard.",
    defaults: { dev: true, staging: true, prod: true },
    reason: "Seed: dark mode is generally available",
  });
  await createFlag(backend, billing, {
    key: "billing.pdf_export_v2",
    description: "New PDF export pipeline (faster, smaller files). Not yet enabled anywhere in prod.",
    expiresAt: inSixMonths,
    defaults: { dev: true, staging: false, prod: false },
    reason: "Seed: PDF export v2 in development",
  });

  await setOverride(
    backend,
    billing,
    "billing.new_invoice_design",
    "prod",
    "client_A",
    true,
    "Seed: Nusantara Logistics is the pilot customer for the new invoice",
  );
  await setOverride(
    backend,
    frontend,
    "frontend.dark_mode",
    "prod",
    "client_C",
    false,
    "Seed: Batik Prima's brand team asked to stay on the light theme",
  );
}
