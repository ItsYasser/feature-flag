import { z } from "zod";
import { ACTOR_HEADER, ENVIRONMENTS, TEAM_HEADER, TEAMS } from "@/lib/domain";
import { zodToApiError } from "./errors";

export const envSchema = z.enum(ENVIRONMENTS, {
  error: () => `environment must be one of ${ENVIRONMENTS.join(", ")}`,
});

export const flagKeySchema = z
  .string()
  .min(3)
  .max(100)
  .regex(
    /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/,
    "flag key must look like <team>.<snake_case_name>, e.g. billing.new_invoice_design",
  );

export const clientIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "client id may only contain letters, digits, _ and -");

const reasonSchema = z.string().trim().max(500, "reason must be at most 500 characters");

export const actorSchema = z.object({
  user: z
    .string({ error: `missing ${ACTOR_HEADER} header` })
    .min(1, `missing ${ACTOR_HEADER} header`)
    .max(64),
  team: z.enum(TEAMS, { error: `${TEAM_HEADER} header must be one of ${TEAMS.join(", ")}` }),
});

export const createFlagBody = z
  .object({
    key: flagKeySchema,
    description: z.string().trim().max(500).default(""),
    expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
    defaults: z
      .object({ dev: z.boolean(), staging: z.boolean(), prod: z.boolean() })
      .partial()
      .optional(),
    reason: reasonSchema.optional(),
  })
  .strict();

export const patchFlagBody = z
  .object({
    description: z.string().trim().max(500).optional(),
    expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
    ownerTeam: z.enum(TEAMS).optional(),
    reason: reasonSchema.optional(),
  })
  .strict()
  .refine((b) => b.description !== undefined || b.expiresAt !== undefined || b.ownerTeam !== undefined, {
    message: "nothing to update — send description, expiresAt or ownerTeam (key is immutable)",
  });

export const toggleBody = z
  .object({
    enabled: z.boolean({ error: "enabled must be true or false" }),
    reason: reasonSchema.optional(),
  })
  .strict();

export const reasonOnlyBody = z.object({ reason: reasonSchema.optional() }).strict();

export const evaluateQuery = z.object({
  flag: flagKeySchema,
  client: clientIdSchema,
  env: envSchema,
});

export const auditQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  env: envSchema.optional(),
});

export const listQuery = z.object({
  status: z.enum(["active", "archived", "all"]).default("all"),
});

export function parse<T extends z.ZodType>(schema: T, input: unknown, where: string): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    // PATCH bodies that try to change the key get a specific, friendlier message.
    if (where === "request body" && input && typeof input === "object" && "key" in input) {
      const keyIssue = result.error.issues.find(
        (i) => i.code === "unrecognized_keys" && i.keys.includes("key"),
      );
      if (keyIssue) {
        throw zodToApiError(
          new z.ZodError([{ ...keyIssue, path: ["key"], message: "key is immutable after creation" }]),
          where,
        );
      }
    }
    throw zodToApiError(result.error, where);
  }
  return result.data;
}
