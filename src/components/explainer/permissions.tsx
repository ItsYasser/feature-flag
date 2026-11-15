import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Cell = { ok: boolean; note?: string };

const COLUMNS = [
  { title: "Owning team", sub: "SSO, e.g. billing on billing.*" },
  { title: "Any other team", sub: "SSO, e.g. frontend on billing.*" },
  { title: "Service token", sub: "one read-only token per service" },
];

const ROWS: { action: string; cells: [Cell, Cell, Cell] }[] = [
  { action: "Read the ruleset (poll)", cells: [{ ok: true }, { ok: true }, { ok: true }] },
  { action: "List flags & read the audit log", cells: [{ ok: true }, { ok: true }, { ok: false }] },
  { action: "Create a flag in its namespace", cells: [{ ok: true, note: "key starts with team." }, { ok: false, note: "403" }, { ok: false }] },
  { action: "Change a default in dev / staging", cells: [{ ok: true }, { ok: false, note: "403" }, { ok: false }] },
  { action: "Change a default in prod", cells: [{ ok: true, note: "reason + confirmation" }, { ok: false, note: "403" }, { ok: false }] },
  { action: "Add or remove a client override", cells: [{ ok: true, note: "reason required in prod" }, { ok: false, note: "403" }, { ok: false }] },
  { action: "Archive a flag", cells: [{ ok: true, note: "always needs a reason" }, { ok: false, note: "403" }, { ok: false }] },
  { action: "Rename a key, or edit/delete audit rows", cells: [{ ok: false, note: "blocked in the database" }, { ok: false }, { ok: false }] },
];

export function Permissions() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Action</th>
              {COLUMNS.map((c) => (
                <th key={c.title} className="px-4 py-3">
                  <div className="text-sm font-semibold">{c.title}</div>
                  <div className="text-[11px] font-normal text-muted-foreground">{c.sub}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.action} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{r.action}</td>
                {r.cells.map((c, i) => (
                  <td key={i} className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-full",
                          c.ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {c.ok ? <CheckIcon className="size-3" strokeWidth={3} /> : <XIcon className="size-3" strokeWidth={3} />}
                      </span>
                      {c.note && (
                        <span className={cn("text-xs", c.note === "403" ? "font-mono font-semibold text-destructive" : "text-muted-foreground")}>
                          {c.note}
                        </span>
                      )}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t px-4 py-3 text-xs text-muted-foreground">Enforced by the server, not the UI.</p>
    </div>
  );
}
