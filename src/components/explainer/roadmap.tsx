"use client";

import { motion } from "framer-motion";
import { FlagIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Demo = "yes" | "partial" | "no";

const MILESTONES = [
  {
    id: "M1",
    name: "MVP",
    weeks: "weeks 1–3",
    goal: "One real flag, in one real service, with one client override, in production.",
    tickets: [
      { id: "FF-1", title: "Postgres schema, migrations, seed; version bumped in the same transaction as each write", done: "Migrations run in CI", demo: "yes" as Demo },
      { id: "FF-2", title: "Admin API: create/list/archive, defaults, overrides; an audit row on every write", done: "API tests pass; audit row on every write", demo: "yes" as Demo },
      { id: "FF-3", title: "Ruleset endpoint with in-memory serialized cache, ETag/304", done: "Load test: 2k polls/s, p99 < 20 ms", demo: "partial" as Demo, demoNote: "ETag/304, cache not built" },
      { id: "FF-4", title: "SDK: in-memory map, polling, atomic swap, fallbacks, unknown-key warning, staleness, emergency override", done: "< 50 µs per check; works with API down", demo: "yes" as Demo },
      { id: "FF-5", title: "Auth: read-only token per service; SSO + team roles for writes", done: "A team can't change another team's flags", demo: "partial" as Demo, demoNote: "team check real, SSO simulated" },
      { id: "FF-6", title: "Admin tooling v0: page to toggle flags and view the audit log", done: "A non-developer can flip a flag for one client", demo: "yes" as Demo },
      { id: "FF-7", title: "Pilot: one service, one real flag, one client override in prod, plus a runbook", done: "Flip seen in prod in < 30 s; undone cleanly", demo: "no" as Demo },
    ],
  },
  {
    id: "M2",
    name: "Adoption",
    weeks: "weeks 4–6",
    goal: "More teams, more flags, and the tooling to keep them healthy.",
    tickets: [
      { id: "FF-8", title: "Admin UI: search, per-client view, confirmation step for prod changes", done: "Used by 2+ teams", demo: "partial" as Demo, demoNote: "prod confirmation" },
      { id: "FF-9", title: "Observability: version per SDK instance, poll errors, propagation time, stale alerts", done: "Alert fires in a chaos test", demo: "partial" as Demo, demoNote: "version, staleness, poll log" },
      { id: "FF-10", title: "Flag hygiene: expires_at reminders and an unused-flag report", done: "Weekly report sent to owners", demo: "no" as Demo },
      { id: "FF-11", title: "Second-language SDK with shared test vectors", done: "Same results on all vectors", demo: "no" as Demo },
    ],
  },
];

const DEMO_BADGE: Record<Demo, { label: string; className: string } | null> = {
  yes: { label: "in live demo", className: "bg-success/15 text-success" },
  partial: { label: "partly in demo", className: "bg-warning/20 text-warning" },
  no: null,
};

export function Roadmap() {
  return (
    <div className="space-y-6">
      {/* Timeline */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="relative">
          <div className="grid grid-cols-6 gap-1 text-center text-[11px] text-muted-foreground">
            {[1, 2, 3, 4, 5, 6].map((w) => (
              <span key={w}>Week {w}</span>
            ))}
          </div>
          <div className="relative mt-2 grid grid-cols-6 gap-1">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ originX: 0 }}
              className="col-span-3 flex h-9 items-center rounded-l-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
            >
              M1 · MVP
            </motion.div>
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.7, ease: "easeOut" }}
              style={{ originX: 0 }}
              className="col-span-3 flex h-9 items-center rounded-r-lg bg-primary/25 px-3 text-xs font-semibold text-accent-foreground"
            >
              M2 · Adoption
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.9 }}
              className="absolute top-full left-1/2 mt-1.5 flex -translate-x-1/2 items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success"
            >
              <FlagIcon className="size-3" /> Pilot in production
            </motion.div>
          </div>
        </div>
        <p className="mt-9 text-sm text-muted-foreground">
          2–3 engineers. One flag live first, then grow.
        </p>
      </div>

      {/* Tickets */}
      <div className="grid gap-4 lg:grid-cols-2">
        {MILESTONES.map((m) => (
          <div key={m.id}>
            <div className="mb-2 flex items-baseline gap-2">
              <span className={cn("rounded-md px-1.5 py-0.5 font-mono text-xs font-bold", m.id === "M1" ? "bg-primary text-primary-foreground" : "bg-primary/25 text-accent-foreground")}>
                {m.id}
              </span>
              <span className="font-semibold">{m.name}</span>
              <span className="text-xs text-muted-foreground">{m.weeks}</span>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">{m.goal}</p>
            <ol className="space-y-2">
              {m.tickets.map((t, i) => {
                const badge = DEMO_BADGE[t.demo];
                return (
                  <motion.li
                    key={t.id}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className={cn("rounded-lg border bg-card p-3", t.id === "FF-7" && "border-success/50")}
                  >
                    <div className="flex items-start gap-2">
                      <code className="shrink-0 rounded bg-muted px-1.5 py-px font-mono text-[11px] font-semibold">{t.id}</code>
                      <span className="flex-1 text-sm">{t.title}</span>
                      {badge && (
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", badge.className)} title={"demoNote" in t ? t.demoNote : undefined}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 pl-12 text-[11px] text-muted-foreground">
                      <span>
                        <span className="font-medium text-foreground/80">Done when:</span> {t.done}
                      </span>
                      {"demoNote" in t && <span className="italic">demo: {t.demoNote}</span>}
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
