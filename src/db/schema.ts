import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const environmentEnum = pgEnum("environment", ["dev", "staging", "prod"]);
export const flagStatusEnum = pgEnum("flag_status", ["active", "archived"]);

export const flags = pgTable("flags", {
  id: serial("id").primaryKey(),
  // Immutable after creation — enforced by the API (PATCH rejects it) and by a DB trigger.
  key: text("key").notNull().unique(),
  description: text("description").notNull().default(""),
  ownerTeam: text("owner_team").notNull(),
  status: flagStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const flagDefaults = pgTable(
  "flag_defaults",
  {
    flagId: integer("flag_id")
      .notNull()
      .references(() => flags.id),
    environment: environmentEnum("environment").notNull(),
    enabled: boolean("enabled").notNull(),
  },
  (t) => [primaryKey({ columns: [t.flagId, t.environment] })],
);

export const flagOverrides = pgTable(
  "flag_overrides",
  {
    flagId: integer("flag_id")
      .notNull()
      .references(() => flags.id),
    environment: environmentEnum("environment").notNull(),
    clientId: text("client_id").notNull(),
    enabled: boolean("enabled").notNull(),
    reason: text("reason").notNull().default(""),
    updatedBy: text("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.flagId, t.environment, t.clientId] })],
);

// Append-only. A trigger in the migration rejects UPDATE and DELETE.
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    flagId: integer("flag_id").references(() => flags.id),
    environment: environmentEnum("environment").notNull(),
    clientId: text("client_id"),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason").notNull().default(""),
    // The ruleset version this write produced — makes "every write = exactly +1" auditable.
    version: bigint("version", { mode: "number" }).notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_flag_idx").on(t.flagId, t.id)],
);

export const rulesetVersion = pgTable("ruleset_version", {
  environment: environmentEnum("environment").primaryKey(),
  version: bigint("version", { mode: "number" }).notNull().default(0),
});

export type FlagRow = typeof flags.$inferSelect;
export type AuditRow = typeof auditLog.$inferSelect;
