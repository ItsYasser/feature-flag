import { cn } from "@/lib/utils";

const EXCHANGES = [
  {
    title: "Nothing changed",
    tag: "almost every poll",
    tone: "muted" as const,
    request: ["GET /v1/rulesets/prod", 'If-None-Match: "45"'],
    status: "304 Not Modified",
    headers: ['ETag: "45"', "Cache-Control: no-store"],
    body: "(empty body: 0 bytes)",
    note: "One number compared. Nothing downloaded.",
  },
  {
    title: "Something changed",
    tag: "right after a write",
    tone: "success" as const,
    request: ["GET /v1/rulesets/prod", 'If-None-Match: "44"'],
    status: "200 OK",
    headers: ['ETag: "45"', "Cache-Control: no-store", "Content-Type: application/json"],
    body: '{ "version": 45, "flags": { … } }',
    note: "The SDK swaps in the new rules all at once.",
  },
];

export function HttpExchanges() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {EXCHANGES.map((x) => (
        <div key={x.title} className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="font-semibold">{x.title}</span>
            <span className="text-xs text-muted-foreground">{x.tag}</span>
          </div>
          <div className="space-y-2 p-4 font-mono text-xs">
            <div className="rounded-lg border bg-muted/40 p-2.5">
              <div className="mb-1 font-sans text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">SDK → Flag API</div>
              {x.request.map((l) => (
                <div key={l}>{l}</div>
              ))}
            </div>
            <div
              className={cn(
                "rounded-lg border p-2.5",
                x.tone === "success" ? "border-success/40 bg-success/10" : "bg-muted/40",
              )}
            >
              <div className="mb-1 font-sans text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Flag API → SDK</div>
              <div className={cn("font-semibold", x.tone === "success" ? "text-success" : "text-foreground")}>{x.status}</div>
              {x.headers.map((l) => (
                <div key={l} className="text-muted-foreground">
                  {l}
                </div>
              ))}
              <div className="mt-1.5 border-t pt-1.5 italic">{x.body}</div>
            </div>
          </div>
          <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">{x.note}</p>
        </div>
      ))}
    </div>
  );
}
