"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TEAMS, USERS, type DemoUser } from "@/lib/domain";
import { cn } from "@/lib/utils";

const TEAM_COLOR: Record<string, string> = {
  billing: "bg-primary/15 text-primary",
  frontend: "bg-warning/20 text-warning",
};

export function Avatar({ user, className }: { user: DemoUser; className?: string }) {
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold", TEAM_COLOR[user.team], className)}>
      {initials}
    </span>
  );
}

export function TeamBadge({ team, className }: { team: string; className?: string }) {
  return (
    <span className={cn("rounded px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase", TEAM_COLOR[team], className)}>
      {team}
    </span>
  );
}

export function IdentityPicker({ actor, onChange }: { actor: DemoUser; onChange(user: DemoUser): void }) {
  return (
    <Select
      value={actor.id}
      items={USERS.map((u) => ({ value: u.id, label: u.name }))}
      onValueChange={(id) => {
        const u = USERS.find((x) => x.id === id);
        if (u) onChange(u);
      }}
    >
      <SelectTrigger className="h-8 min-w-56 gap-2 pl-1.5" aria-label="Acting as">
        <Avatar user={actor} />
        <SelectValue className="font-medium" />
        <TeamBadge team={actor.team} className="ml-auto" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="min-w-64">
        {TEAMS.map((team) => (
          <SelectGroup key={team}>
            <SelectLabel>Team {team}</SelectLabel>
            {USERS.filter((u) => u.team === team).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                <Avatar user={u} className="size-5" />
                {u.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
