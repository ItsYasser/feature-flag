import { CheckIcon, MinusIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Callout } from "./section";

type Mark = "yes" | "no" | "meh";

const ROWS: { aspect: string; polling: [Mark, string]; push: [Mark, string] }[] = [
  { aspect: "Moving parts", polling: ["yes", "Plain HTTP request every 15 s"], push: ["no", "Long-lived connections to keep alive"] },
  { aspect: "Cost when nothing changes", polling: ["yes", "304 with an empty body"], push: ["yes", "Idle connection"] },
  { aspect: "Dropped connections", polling: ["yes", "Next poll just tries again"], push: ["no", "Must reconnect; changes sent meanwhile are missed"] },
  { aspect: "Proxies and load balancers", polling: ["yes", "Short requests, nothing to cut"], push: ["no", "Often close long-open connections"] },
  { aspect: "Server state", polling: ["yes", "Stateless: any instance answers"], push: ["no", "Must track who is connected"] },
  { aspect: "After a reconnect", polling: ["yes", "Same endpoint as always"], push: ["meh", "Still needs a full download, so polling exists anyway"] },
  { aspect: "Time to reach services", polling: ["meh", "Up to ~15 s"], push: ["yes", "About 1 s"] },
];

function MarkIcon({ m }: { m: Mark }) {
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full",
        m === "yes" && "bg-success/15 text-success",
        m === "no" && "bg-destructive/15 text-destructive",
        m === "meh" && "bg-warning/20 text-warning",
      )}
    >
      {m === "yes" ? <CheckIcon className="size-3" strokeWidth={3} /> : m === "no" ? <XIcon className="size-3" strokeWidth={3} /> : <MinusIcon className="size-3" strokeWidth={3} />}
    </span>
  );
}

export function TradeOff() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="w-48 px-4 py-3 text-xs font-medium text-muted-foreground" />
                <th className="bg-accent/60 px-4 py-3">
                  <div className="font-semibold">Polling every 15 s</div>
                  <span className="rounded-full bg-primary px-2 py-px text-[10px] font-semibold text-primary-foreground">CHOSEN</span>
                </th>
                <th className="px-4 py-3">
                  <div className="font-semibold text-muted-foreground">Push over SSE / WebSockets</div>
                  <span className="rounded-full bg-muted px-2 py-px text-[10px] font-semibold text-muted-foreground">REJECTED FOR V1</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.aspect} className="border-b last:border-b-0">
                  <td className="px-4 py-2.5 text-xs font-medium text-muted-foreground">{r.aspect}</td>
                  <td className="bg-accent/30 px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <MarkIcon m={r.polling[0]} />
                      {r.polling[1]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <MarkIcon m={r.push[0]} />
                      {r.push[1]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Callout tone="warning" title="The cost we accept">
          Changes take up to ~15 s. Push can be added later on top of polling.
        </Callout>
        <Callout title="Why PostgreSQL">
          The data is relational and audit rows need transactions. Reads never hit it anyway.
        </Callout>
      </div>
    </div>
  );
}
