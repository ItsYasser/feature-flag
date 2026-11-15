import { ACTOR_HEADER, TEAM_HEADER, type Environment, type Team } from "@/lib/domain";
import { ApiError, badRequest, forbidden } from "./errors";
import { actorSchema } from "./validation";

export interface Actor {
  user: string;
  team: Team;
}

/**
 * Simulated auth: the demo UI sends the "acting as" user and team in headers.
 * A real deployment would read these from a verified SSO session instead — the permission
 * check below would not change.
 */
export function getActor(headers: Headers): Actor {
  const result = actorSchema.safeParse({
    user: headers.get(ACTOR_HEADER) ?? undefined,
    team: headers.get(TEAM_HEADER) ?? undefined,
  });
  if (!result.success) {
    throw new ApiError(
      401,
      "unauthenticated",
      `Who is making this change? ${result.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return result.data;
}

/** A team may only change flags it owns. Pure function so it is trivially unit-testable. */
export function canModify(actor: Pick<Actor, "team">, flag: { ownerTeam: string }): boolean {
  return actor.team === flag.ownerTeam;
}

export function assertCanModify(actor: Actor, flag: { key: string; ownerTeam: string }): void {
  if (!canModify(actor, flag)) {
    throw forbidden(
      `Team "${actor.team}" cannot change ${flag.key} — it is owned by team "${flag.ownerTeam}".`,
      { actorTeam: actor.team, ownerTeam: flag.ownerTeam },
    );
  }
}

/** Every prod change needs a human-readable reason; dev/staging may omit it. */
export function assertReason(env: Environment | "all", reason: string | undefined): string {
  const trimmed = (reason ?? "").trim();
  if ((env === "prod" || env === "all") && trimmed.length < 3) {
    throw badRequest("A reason is required for production changes (at least 3 characters).", {
      field: "reason",
    });
  }
  return trimmed;
}
