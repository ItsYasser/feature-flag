import { BroomIcon, FileSearchIcon, GaugeIcon, ShieldCheckIcon, TimerIcon, UsersRoundIcon } from "lucide-react";
import { Stagger, StaggerItem } from "./section";

const METRICS = [
  { icon: GaugeIcon, name: "Fast", target: "< 50 µs", detail: "per flag check" },
  { icon: TimerIcon, name: "Up to date", target: "< 30 s", detail: "to reach every service" },
  { icon: ShieldCheckIcon, name: "Safe", target: "30 min", detail: "of API downtime with no errors" },
  { icon: FileSearchIcon, name: "Traceable", target: "100%", detail: "of prod changes logged with who and why" },
  { icon: UsersRoundIcon, name: "Used", target: "3 teams · 10 flags", detail: "live by week 6" },
  { icon: BroomIcon, name: "Clean", target: "0 forgotten", detail: "stale flags left behind" },
];

const DEFERRED = [
  "Percentage rollouts",
  "Client groups",
  "Instant push updates",
  "Approval steps for prod",
  "Non-boolean flags",
  "A/B testing",
  "Multiple regions",
  "Access for external clients",
];

export function Metrics() {
  return (
    <div className="space-y-6">
      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {METRICS.map((m) => {
          const Icon = m.icon;
          return (
            <StaggerItem key={m.name} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </span>
                {m.name}
              </div>
              <div className="mt-3 font-mono text-2xl font-semibold tracking-tight tabular">{m.target}</div>
              <p className="mt-1 text-xs text-muted-foreground">{m.detail}</p>
            </StaggerItem>
          );
        })}
      </Stagger>

      <div className="rounded-xl border border-dashed p-4">
        <div className="text-sm font-semibold">Later</div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {DEFERRED.map((d) => (
            <span key={d} className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
