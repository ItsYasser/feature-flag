import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Backend, Db, Tx } from "@/db";
import { auditLog, flagDefaults, flagOverrides, flags, rulesetVersion, type FlagRow } from "@/db/schema";
import { ENVIRONMENTS, type Environment, type Team } from "@/lib/domain";
import type { RulesetPayload } from "@/lib/sdk/types";
import { assertCanModify, assertReason, type Actor } from "./auth";
import { badRequest, conflict, notFound } from "./errors";

// ---------------------------------------------------------------------------------------------
// View types returned by the admin API
// ---------------------------------------------------------------------------------------------

export interface OverrideView {
  clientId: string;
  enabled: boolean;
  reason: string;
  updatedBy: string;
  updatedAt: string;
}

export interface FlagView {
  key: string;
  description: string;
  ownerTeam: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  environments: Record<Environment, { default: boolean; overrides: OverrideView[] }>;
}

export interface AuditView {
  id: number;
  flagKey: string | null;
  environment: Environment;
  clientId: string | null;
  actor: string;
  action: string;
  before: unknown;
  after: unknown;
  reason: string;
  version: number;
  at: string;
}

export interface WriteResult {
  flag: FlagView;
  /** false when the request asked for the state the flag was already in (nothing written). */
  changed: boolean;
  /** Ruleset versions produced by this write, per environment touched. */
  versions: Partial<Record<Environment, number>>;
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

async function loadViews(db: Db | Tx, rows: FlagRow[]): Promise<FlagView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [defaults, overrides] = await Promise.all([
    db.select().from(flagDefaults).where(inArray(flagDefaults.flagId, ids)),
    db.select().from(flagOverrides).where(inArray(flagOverrides.flagId, ids)),
  ]);

  return rows.map((row) => {
    const environments = Object.fromEntries(
      ENVIRONMENTS.map((env) => [
        env,
        {
          default: defaults.find((d) => d.flagId === row.id && d.environment === env)?.enabled ?? false,
          overrides: overrides
            .filter((o) => o.flagId === row.id && o.environment === env)
            .sort((a, b) => a.clientId.localeCompare(b.clientId))
            .map((o) => ({
              clientId: o.clientId,
              enabled: o.enabled,
              reason: o.reason,
              updatedBy: o.updatedBy,
              updatedAt: iso(o.updatedAt)!,
            })),
        },
      ]),
    ) as FlagView["environments"];

    return {
      key: row.key,
      description: row.description,
      ownerTeam: row.ownerTeam,
      status: row.status,
      createdAt: iso(row.createdAt)!,
      updatedAt: iso(row.updatedAt)!,
      expiresAt: iso(row.expiresAt),
      environments,
    };
  });
}

export async function listFlags(
  backend: Backend,
  status: "active" | "archived" | "all" = "all",
): Promise<FlagView[]> {
  const rows = await backend.read
    .select()
    .from(flags)
    .where(status === "all" ? undefined : eq(flags.status, status))
    .orderBy(flags.key);
  return loadViews(backend.read, rows);
}

export async function getFlag(backend: Backend, key: string): Promise<FlagView> {
  const [row] = await backend.read.select().from(flags).where(eq(flags.key, key));
  if (!row) throw notFound(`Flag ${key} does not exist.`);
  return (await loadViews(backend.read, [row]))[0];
}

export async function listAudit(
  backend: Backend,
  opts: { flagKey?: string; env?: Environment; limit?: number } = {},
): Promise<AuditView[]> {
  let flagId: number | undefined;
  if (opts.flagKey) {
    const [row] = await backend.read
      .select({ id: flags.id })
      .from(flags)
      .where(eq(flags.key, opts.flagKey));
    if (!row) throw notFound(`Flag ${opts.flagKey} does not exist.`);
    flagId = row.id;
  }
  const rows = await backend.read
    .select({ a: auditLog, flagKey: flags.key })
    .from(auditLog)
    .leftJoin(flags, eq(auditLog.flagId, flags.id))
    .where(
      and(
        flagId !== undefined ? eq(auditLog.flagId, flagId) : undefined,
        opts.env ? eq(auditLog.environment, opts.env) : undefined,
      ),
    )
    .orderBy(desc(auditLog.id))
    .limit(opts.limit ?? 50);

  return rows.map(({ a, flagKey }) => ({
    id: Number(a.id),
    flagKey,
    environment: a.environment,
    clientId: a.clientId,
    actor: a.actor,
    action: a.action,
    before: a.before,
    after: a.after,
    reason: a.reason,
    version: Number(a.version),
    at: iso(a.at)!,
  }));
}

/** The cheap query behind the 304 path: one row, one column, primary-key lookup. */
export async function getRulesetVersion(backend: Backend, env: Environment): Promise<number> {
  const [row] = await backend.read
    .select({ version: rulesetVersion.version })
    .from(rulesetVersion)
    .where(eq(rulesetVersion.environment, env));
  return Number(row?.version ?? 0);
}

/**
 * The full ruleset for one environment, built in a SINGLE SQL statement so the version and the
 * flag data come from the same snapshot — a write landing mid-read can't produce a payload whose
 * version doesn't match its contents.
 */
export async function getRuleset(backend: Backend, env: Environment): Promise<RulesetPayload> {
  const result = await backend.read.execute(sql`
    SELECT
      rv.version::text AS version,
      COALESCE((
        SELECT json_object_agg(
          f.key,
          json_build_object(
            'default', d.enabled,
            'overrides', COALESCE((
              SELECT json_object_agg(o.client_id, o.enabled ORDER BY o.client_id)
              FROM flag_overrides o
              WHERE o.flag_id = f.id AND o.environment = rv.environment
            ), '{}'::json)
          )
          ORDER BY f.key
        )
        FROM flags f
        JOIN flag_defaults d ON d.flag_id = f.id AND d.environment = rv.environment
        WHERE f.status = 'active'
      ), '{}'::json) AS flags
    FROM ruleset_version rv
    WHERE rv.environment = ${env}
  `);
  // Drivers differ in shape: PGlite and node-style drivers return { rows }, some return the array.
  type Row = { version: string; flags: unknown };
  const rows: Row[] = Array.isArray(result) ? (result as Row[]) : (result as unknown as { rows: Row[] }).rows;
  const row = rows[0];
  const flagsJson = typeof row?.flags === "string" ? JSON.parse(row.flags) : (row?.flags ?? {});
  return { env, version: Number(row?.version ?? 0), flags: flagsJson as RulesetPayload["flags"] };
}

// ---------------------------------------------------------------------------------------------
// Writes — every write: (1) change its table, (2) append audit_log, (3) bump ruleset_version
// for each environment it affects. All three in ONE transaction.
// ---------------------------------------------------------------------------------------------

interface AuditInput {
  flagId: number;
  env: Environment;
  clientId?: string | null;
  actor: Actor;
  action: string;
  before: unknown;
  after: unknown;
  reason: string;
}

/** Bump the environment's version and append the audit row. Returns the new version. */
async function recordWrite(tx: Tx, input: AuditInput): Promise<number> {
  // UPDATE ... RETURNING takes a row lock on the version row, so concurrent writers to the same
  // environment are serialised and versions are strictly sequential (no gaps, no duplicates).
  const [row] = await tx
    .insert(rulesetVersion)
    .values({ environment: input.env, version: 1 })
    .onConflictDoUpdate({
      target: rulesetVersion.environment,
      set: { version: sql`${rulesetVersion.version} + 1` },
    })
    .returning({ version: rulesetVersion.version });
  const version = Number(row.version);

  await tx.insert(auditLog).values({
    flagId: input.flagId,
    environment: input.env,
    clientId: input.clientId ?? null,
    actor: `${input.actor.user} (${input.actor.team})`,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason,
    version,
  });
  return version;
}

async function lockFlag(tx: Tx, key: string): Promise<FlagRow> {
  const [row] = await tx.select().from(flags).where(eq(flags.key, key)).for("update");
  if (!row) throw notFound(`Flag ${key} does not exist.`);
  return row;
}

function assertActive(flag: FlagRow) {
  if (flag.status === "archived") throw conflict(`Flag ${flag.key} is archived and can no longer be changed.`);
}

async function finish(tx: Tx, flagId: number, changed: boolean, versions: WriteResult["versions"]) {
  const [row] = await tx.select().from(flags).where(eq(flags.id, flagId));
  const [view] = await loadViews(tx, [row]);
  return { flag: view, changed, versions };
}

export async function createFlag(
  backend: Backend,
  actor: Actor,
  input: {
    key: string;
    description: string;
    expiresAt?: string | null;
    defaults?: Partial<Record<Environment, boolean>>;
    reason?: string;
  },
): Promise<WriteResult> {
  const prefix = input.key.split(".")[0];
  if (prefix !== actor.team) {
    throw badRequest(
      `Flag keys are namespaced by owning team: as team "${actor.team}" your key must start with "${actor.team}."`,
    );
  }
  const defaults = { dev: false, staging: false, prod: false, ...input.defaults };
  const reason = assertReason(defaults.prod ? "prod" : "dev", input.reason);

  return backend.transaction(async (tx) => {
    const [exists] = await tx.select({ id: flags.id }).from(flags).where(eq(flags.key, input.key));
    if (exists) throw conflict(`Flag ${input.key} already exists.`);

    const [flag] = await tx
      .insert(flags)
      .values({
        key: input.key,
        description: input.description,
        ownerTeam: actor.team as Team,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      })
      .returning();

    const versions: WriteResult["versions"] = {};
    for (const env of ENVIRONMENTS) {
      await tx.insert(flagDefaults).values({ flagId: flag.id, environment: env, enabled: defaults[env] });
      versions[env] = await recordWrite(tx, {
        flagId: flag.id,
        env,
        actor,
        action: "flag.created",
        before: null,
        after: { default: defaults[env], ownerTeam: flag.ownerTeam, description: flag.description },
        reason,
      });
    }
    return finish(tx, flag.id, true, versions);
  });
}

export async function updateFlagMeta(
  backend: Backend,
  actor: Actor,
  key: string,
  patch: { description?: string; expiresAt?: string | null; ownerTeam?: Team; reason?: string },
): Promise<WriteResult> {
  return backend.transaction(async (tx) => {
    const flag = await lockFlag(tx, key);
    assertCanModify(actor, flag);
    assertActive(flag);

    const before = { description: flag.description, expiresAt: iso(flag.expiresAt), ownerTeam: flag.ownerTeam };
    const after = {
      description: patch.description ?? flag.description,
      expiresAt: patch.expiresAt === undefined ? before.expiresAt : iso(patch.expiresAt),
      ownerTeam: patch.ownerTeam ?? flag.ownerTeam,
    };
    if (JSON.stringify(before) === JSON.stringify(after)) return finish(tx, flag.id, false, {});
    const reason = assertReason(after.ownerTeam !== before.ownerTeam ? "all" : "dev", patch.reason);

    await tx
      .update(flags)
      .set({
        description: after.description,
        expiresAt: after.expiresAt ? new Date(after.expiresAt) : null,
        ownerTeam: after.ownerTeam,
        updatedAt: new Date(),
      })
      .where(eq(flags.id, flag.id));

    // Metadata is part of the flag in every environment, so every environment's version moves.
    const versions: WriteResult["versions"] = {};
    for (const env of ENVIRONMENTS) {
      versions[env] = await recordWrite(tx, { flagId: flag.id, env, actor, action: "flag.updated", before, after, reason });
    }
    return finish(tx, flag.id, true, versions);
  });
}

export async function archiveFlag(
  backend: Backend,
  actor: Actor,
  key: string,
  reasonInput: string | undefined,
): Promise<WriteResult> {
  return backend.transaction(async (tx) => {
    const flag = await lockFlag(tx, key);
    assertCanModify(actor, flag);
    if (flag.status === "archived") return finish(tx, flag.id, false, {});
    // Archiving removes the flag from the prod ruleset, so it is a prod change.
    const reason = assertReason("prod", reasonInput);

    await tx.update(flags).set({ status: "archived", updatedAt: new Date() }).where(eq(flags.id, flag.id));
    const versions: WriteResult["versions"] = {};
    for (const env of ENVIRONMENTS) {
      versions[env] = await recordWrite(tx, {
        flagId: flag.id,
        env,
        actor,
        action: "flag.archived",
        before: { status: "active" },
        after: { status: "archived" },
        reason,
      });
    }
    return finish(tx, flag.id, true, versions);
  });
}

export async function setDefault(
  backend: Backend,
  actor: Actor,
  key: string,
  env: Environment,
  enabled: boolean,
  reasonInput: string | undefined,
): Promise<WriteResult> {
  return backend.transaction(async (tx) => {
    const flag = await lockFlag(tx, key);
    assertCanModify(actor, flag);
    assertActive(flag);
    const reason = assertReason(env, reasonInput);

    const [current] = await tx
      .select()
      .from(flagDefaults)
      .where(and(eq(flagDefaults.flagId, flag.id), eq(flagDefaults.environment, env)));
    if (current?.enabled === enabled) return finish(tx, flag.id, false, {});

    await tx
      .insert(flagDefaults)
      .values({ flagId: flag.id, environment: env, enabled })
      .onConflictDoUpdate({ target: [flagDefaults.flagId, flagDefaults.environment], set: { enabled } });
    await tx.update(flags).set({ updatedAt: new Date() }).where(eq(flags.id, flag.id));

    const version = await recordWrite(tx, {
      flagId: flag.id,
      env,
      actor,
      action: "default.set",
      before: current ? { enabled: current.enabled } : null,
      after: { enabled },
      reason,
    });
    return finish(tx, flag.id, true, { [env]: version });
  });
}

export async function setOverride(
  backend: Backend,
  actor: Actor,
  key: string,
  env: Environment,
  clientId: string,
  enabled: boolean,
  reasonInput: string | undefined,
): Promise<WriteResult> {
  return backend.transaction(async (tx) => {
    const flag = await lockFlag(tx, key);
    assertCanModify(actor, flag);
    assertActive(flag);
    const reason = assertReason(env, reasonInput);

    const where = and(
      eq(flagOverrides.flagId, flag.id),
      eq(flagOverrides.environment, env),
      eq(flagOverrides.clientId, clientId),
    );
    const [current] = await tx.select().from(flagOverrides).where(where);
    if (current?.enabled === enabled) return finish(tx, flag.id, false, {});

    const values = { enabled, reason, updatedBy: actor.user, updatedAt: new Date() };
    await tx
      .insert(flagOverrides)
      .values({ flagId: flag.id, environment: env, clientId, ...values })
      .onConflictDoUpdate({
        target: [flagOverrides.flagId, flagOverrides.environment, flagOverrides.clientId],
        set: values,
      });
    await tx.update(flags).set({ updatedAt: new Date() }).where(eq(flags.id, flag.id));

    const version = await recordWrite(tx, {
      flagId: flag.id,
      env,
      clientId,
      actor,
      action: current ? "override.updated" : "override.added",
      before: current ? { enabled: current.enabled } : null,
      after: { enabled },
      reason,
    });
    return finish(tx, flag.id, true, { [env]: version });
  });
}

export async function deleteOverride(
  backend: Backend,
  actor: Actor,
  key: string,
  env: Environment,
  clientId: string,
  reasonInput: string | undefined,
): Promise<WriteResult> {
  return backend.transaction(async (tx) => {
    const flag = await lockFlag(tx, key);
    assertCanModify(actor, flag);
    assertActive(flag);
    const reason = assertReason(env, reasonInput);

    const where = and(
      eq(flagOverrides.flagId, flag.id),
      eq(flagOverrides.environment, env),
      eq(flagOverrides.clientId, clientId),
    );
    const [current] = await tx.select().from(flagOverrides).where(where);
    if (!current) return finish(tx, flag.id, false, {});

    await tx.delete(flagOverrides).where(where);
    await tx.update(flags).set({ updatedAt: new Date() }).where(eq(flags.id, flag.id));

    const version = await recordWrite(tx, {
      flagId: flag.id,
      env,
      clientId,
      actor,
      action: "override.removed",
      before: { enabled: current.enabled },
      after: null,
      reason,
    });
    return finish(tx, flag.id, true, { [env]: version });
  });
}
