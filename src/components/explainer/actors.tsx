import {
  BuildingIcon,
  CodeXmlIcon,
  DatabaseIcon,
  ServerIcon,
  SirenIcon,
  UsersIcon,
  UserXIcon,
} from "lucide-react";
import { Stagger, StaggerItem } from "./section";

const ACTORS = [
  { icon: UsersIcon, name: "Owning team", example: "e.g. billing", role: "Creates and flips its own flags.", tone: "primary" },
  { icon: UserXIcon, name: "Other teams", example: "e.g. frontend", role: "Can look, can't change. Gets a 403.", tone: "muted" },
  { icon: ServerIcon, name: "Flag API", example: "2 instances", role: "Checks permissions, saves changes, serves rulesets.", tone: "primary" },
  { icon: DatabaseIcon, name: "PostgreSQL", example: "source of truth", role: "Stores flags and the audit log.", tone: "primary" },
  { icon: CodeXmlIcon, name: "SDK", example: "in every service", role: "Keeps all flags in memory and polls for changes.", tone: "primary" },
  { icon: BuildingIcon, name: "Client", example: "a customer account", role: "Sees the feature, or doesn't.", tone: "muted" },
  { icon: SirenIcon, name: "On-call", example: "during an incident", role: "Can force a flag on one service, even offline.", tone: "warning" },
] as const;

export function Actors() {
  return (
    <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {ACTORS.map((a) => {
        const Icon = a.icon;
        return (
          <StaggerItem key={a.name} className="flex flex-col rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <span
                className={
                  a.tone === "primary"
                    ? "grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground"
                    : a.tone === "warning"
                      ? "grid size-9 place-items-center rounded-lg bg-warning/15 text-warning"
                      : "grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground"
                }
              >
                <Icon className="size-4.5" />
              </span>
              <div>
                <div className="text-sm font-semibold">{a.name}</div>
                <div className="text-xs text-muted-foreground">{a.example}</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{a.role}</p>
          </StaggerItem>
        );
      })}
      <StaggerItem className="flex items-center rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Writes are rare. Reads never leave the service&apos;s memory.
      </StaggerItem>
    </Stagger>
  );
}
