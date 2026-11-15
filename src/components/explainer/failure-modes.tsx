import { cn } from "@/lib/utils";
import { Stagger, StaggerItem } from "./section";

type Impact = "none" | "low" | "real";

const ROWS: { scenario: string; service: string; client: string; impact: Impact; signal: string }[] = [
  {
    scenario: "Flag API is down",
    service: "Keeps its last copy.",
    client: "Nothing changes for clients.",
    impact: "none",
    signal: "Poll errors; stale-copy alert after 5 min",
  },
  {
    scenario: "API down and a service restarts",
    service: "Uses the fallbacks in code.",
    client: "Safe default until the API is back.",
    impact: "low",
    signal: "“No ruleset” warning in logs and metrics",
  },
  {
    scenario: "Typo in a flag key, or an archived flag",
    service: "Logs a warning, uses the fallback.",
    client: "Safe default, never a crash.",
    impact: "low",
    signal: "Unknown-key warning; generated constants catch most typos",
  },
  {
    scenario: "Someone flips the wrong switch in prod",
    service: "Applies it within 15 s.",
    client: "Undo is one more flip; the audit log shows who.",
    impact: "real",
    signal: "Audit log shows who and why; undo is one more flip",
  },
  {
    scenario: "Postgres is down",
    service: "Unaffected; polls use the API cache.",
    client: "Nothing changes for clients.",
    impact: "none",
    signal: "Writes fail with a clear error; flags can't change until it's back",
  },
  {
    scenario: "Two people change flags at the same time",
    service: "Gets v45 then v46, never a mix.",
    client: "Each change applies cleanly.",
    impact: "none",
    signal: "Two audit rows with consecutive versions",
  },
];

const IMPACT: Record<Impact, { label: string; className: string }> = {
  none: { label: "No impact", className: "bg-success/15 text-success" },
  low: { label: "Safe default", className: "bg-warning/20 text-warning" },
  real: { label: "Visible to client", className: "bg-destructive/15 text-destructive" },
};

export function FailureModes() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Scenario</th>
              <th className="px-4 py-2.5 font-medium">What the service does</th>
              <th className="px-4 py-2.5 font-medium">Client impact</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.scenario} className="border-b align-top last:border-b-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{r.scenario}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.service}</td>
                <td className="px-4 py-3">
                  <span className={cn("mb-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", IMPACT[r.impact].className)}>
                    {IMPACT[r.impact].label}
                  </span>
                  <div className="text-xs text-muted-foreground">{r.client}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Stagger className="grid gap-px border-t bg-border sm:grid-cols-3">
        {[
          ["2 API instances", "make downtime rare"],
          ["Emergency override", "works without the API"],
          ["Reason + confirmation", "on every prod change"],
        ].map(([t, d]) => (
          <StaggerItem key={t} className="bg-card px-4 py-3 text-sm">
            <span className="font-medium">{t}</span> <span className="text-muted-foreground">{d}</span>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
