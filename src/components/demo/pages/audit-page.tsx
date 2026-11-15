"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LockKeyholeIcon, ScrollTextIcon, SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ENVIRONMENTS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { useDemo } from "../demo-context";
import { PageHeader, Stat } from "../page-header";
import { Segmented } from "../segmented";
import { describe } from "../under-the-hood";

type EnvFilter = "all" | "dev" | "staging" | "prod";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function AuditPage() {
  const d = useDemo();
  const [env, setEnv] = useState<EnvFilter>("all");
  const [flag, setFlag] = useState<string>("all");
  const [query, setQuery] = useState("");

  const entries = useMemo(() => d.audit ?? [], [d.audit]);
  const flagKeys = useMemo(() => [...new Set(entries.map((e) => e.flagKey).filter(Boolean) as string[])].sort(), [entries]);
  const q = query.trim().toLowerCase();
  const rows = entries.filter(
    (e) =>
      (env === "all" || e.environment === env) &&
      (flag === "all" || e.flagKey === flag) &&
      (!q || `${e.actor} ${e.reason} ${e.flagKey} ${describe(e)}`.toLowerCase().includes(q)),
  );
  const prodChanges = entries.filter((e) => e.environment === "prod").length;
  const latest = entries[0];

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-5 px-4 py-6">
      <PageHeader
        icon={ScrollTextIcon}
        title="Audit log"
        description="Every change: who, what, why, and the version it produced."
      >
        <Stat label="Production changes" value={prodChanges} />
        <Stat label="Last change" value={latest ? fmt(latest.at).split(", ")[1] : "—"} />
      </PageHeader>

      <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <Segmented
            id="audit-env"
            ariaLabel="Environment filter"
            value={env}
            onChange={setEnv}
            options={[{ value: "all" as const, label: "All", tone: "accent" as const }, ...ENVIRONMENTS.map((e) => ({ value: e, label: e, tone: e === "prod" ? ("danger" as const) : ("accent" as const) }))]}
          />
          <Select
            value={flag}
            items={[{ value: "all", label: "All flags" }, ...flagKeys.map((k) => ({ value: k, label: k }))]}
            onValueChange={(v) => v && setFlag(v)}
          >
            <SelectTrigger size="sm" className="min-w-56 font-mono text-xs" aria-label="Flag filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All flags</SelectItem>
              {flagKeys.map((k) => (
                <SelectItem key={k} value={k} className="font-mono text-xs">
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search person, reason, client…" className="h-7 w-64 pl-8 text-xs" />
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <LockKeyholeIcon className="size-3.5" /> cannot be edited or deleted
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Env · version</th>
                <th className="px-3 py-2 font-medium">Flag</th>
                <th className="px-3 py-2 font-medium">Change</th>
                <th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {rows.map((e) => (
                  <motion.tr
                    key={e.id}
                    layout
                    initial={{ opacity: 0, backgroundColor: "var(--accent)" }}
                    animate={{ opacity: 1, backgroundColor: "rgba(0,0,0,0)" }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, backgroundColor: { duration: 2 } }}
                    className="border-b last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap text-muted-foreground tabular">{fmt(e.at)}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "rounded px-1.5 py-px font-mono text-[11px] font-semibold whitespace-nowrap",
                          e.environment === "prod" ? "bg-destructive/12 text-destructive" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {e.environment} v{e.version}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{e.flagKey}</td>
                    <td className="px-3 py-2.5 font-medium">{describe(e)}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">{e.actor}</td>
                    <td className="max-w-md px-3 py-2.5 text-xs text-muted-foreground">{e.reason ? `“${e.reason}”` : <span className="opacity-50">—</span>}</td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {d.audit ? "No entries match these filters." : "Loading…"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          Latest {entries.length} entries · live
        </div>
      </section>
    </div>
  );
}
