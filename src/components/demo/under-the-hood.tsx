"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ActivityIcon, DatabaseIcon, ScrollTextIcon } from "lucide-react";
import { clientName } from "@/lib/domain";
import type { PollLogEntry } from "@/lib/sdk";
import { cn } from "@/lib/utils";
import type { AuditView } from "./api";
import { DEMO_POLL_INTERVAL_MS, STALE_WARNING_SECONDS, type FlagService } from "./use-flag-service";
import { OpenLink } from "./open-link";

const time = (t: number | string) =>
  new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const STATUS_STYLE = {
  "200": "bg-success text-white",
  "304": "bg-muted-foreground/25 text-foreground/80",
  error: "bg-destructive text-white",
} as const;

export function UnderTheHood({
  service,
  now,
  audit,
  className,
  auditHref,
}: {
  service: FlagService;
  now: number;
  audit: AuditView[] | null;
  className?: string;
  auditHref?: string;
}) {
  const { client, state } = service;
  const staleness = client && state ? client.getStalenessSeconds(now) : Infinity;
  const log = state?.pollLog ?? [];

  return (
    <section className={cn("grid shrink-0 gap-px overflow-hidden rounded-xl border bg-border shadow-xs lg:h-[228px] lg:grid-cols-[1.15fr_0.75fr_1.6fr]", className)}>
      {/* Polls */}
      <Column icon={<ActivityIcon />} title="SDK polls">
        <Heartbeat log={log} bootId={service.bootId} />
        <ol className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          <AnimatePresence initial={false}>
            {log.slice(0, 12).map((e) => (
              <PollRow key={`${service.bootId}-${e.id}`} entry={e} />
            ))}
          </AnimatePresence>
          {log.length === 0 && <li className="text-xs text-muted-foreground">Waiting for the first poll…</li>}
        </ol>
      </Column>

      {/* State */}
      <Column icon={<DatabaseIcon />} title="In memory">
        <div className="flex items-baseline gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={state?.version ?? "none"}
              initial={{ y: 14, opacity: 0, color: "var(--primary)" }}
              animate={{ y: 0, opacity: 1, color: "var(--foreground)" }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.35, color: { duration: 1.6 } }}
              className="font-mono text-3xl font-semibold tabular"
            >
              {state?.version != null ? `v${state.version}` : "—"}
            </motion.span>
          </AnimatePresence>
          <span className="text-xs text-muted-foreground">ruleset version</span>
        </div>
        <StalenessMeter staleness={staleness} />
        <dl className="mt-auto space-y-1 text-xs">
          <Stat label="Last good sync" value={state?.lastSuccessfulSync ? time(state.lastSuccessfulSync) : "—"} />
          <Stat label="Polls every" value={`${DEMO_POLL_INTERVAL_MS / 1000}s`} />
          <Stat label="Flags held" value={state ? String(state.flagCount) : "—"} />
        </dl>
      </Column>

      {/* Audit */}
      <Column
        icon={<ScrollTextIcon />}
        title="audit_log"
        extra={
          auditHref ? (
            <OpenLink href={auditHref} label="Full log" />
          ) : (
            <span className="text-[11px] text-muted-foreground">append-only · newest first</span>
          )
        }
      >
        <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          <AnimatePresence initial={false}>
            {(audit ?? []).map((a) => (
              <AuditRow key={a.id} entry={a} />
            ))}
          </AnimatePresence>
          {audit?.length === 0 && <li className="text-xs text-muted-foreground">No changes yet.</li>}
        </ol>
      </Column>
    </section>
  );
}

function Column({
  icon,
  title,
  extra,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col bg-card px-3.5 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
        <span className="text-muted-foreground [&_svg]:size-3.5">{icon}</span>
        {title}
        <span className="ml-auto font-normal tracking-normal normal-case">{extra}</span>
      </div>
      {children}
    </div>
  );
}

/** One bar per poll, newest on the right: gray = 304, green = 200, red = error. */
function Heartbeat({ log, bootId }: { log: readonly PollLogEntry[]; bootId: number }) {
  const bars = [...log].slice(0, 36).reverse();
  return (
    <div>
      <div className="flex h-7 items-end gap-[3px]">
        {Array.from({ length: Math.max(0, 36 - bars.length) }).map((_, i) => (
          <span key={`e${i}`} className="h-2 flex-1 rounded-sm bg-muted" />
        ))}
        {bars.map((e) => (
          <motion.span
            key={`${bootId}-${e.id}`}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            style={{ originY: 1 }}
            title={`${e.status} · ${time(e.at)}`}
            className={cn(
              "flex-1 rounded-sm",
              e.status === 200 ? "h-7 bg-success" : e.status === 304 ? "h-3.5 bg-muted-foreground/35" : "h-7 bg-destructive",
            )}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
        <Key className="bg-muted-foreground/35">304 not modified</Key>
        <Key className="bg-success">200 new ruleset</Key>
        <Key className="bg-destructive">error</Key>
      </div>
    </div>
  );
}

function Key({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("size-2 rounded-sm", className)} />
      {children}
    </span>
  );
}

function StalenessMeter({ staleness }: { staleness: number }) {
  const finite = Number.isFinite(staleness);
  const pct = finite ? Math.min(100, (staleness / STALE_WARNING_SECONDS) * 100) : 100;
  const tone = !finite ? "bg-destructive" : staleness >= STALE_WARNING_SECONDS ? "bg-warning" : staleness > 7 ? "bg-warning/70" : "bg-success";
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Staleness</span>
        <span className={cn("font-mono font-semibold tabular", finite && staleness >= STALE_WARNING_SECONDS && "text-warning", !finite && "text-destructive")}>
          {finite ? `${Math.floor(staleness)}s` : "never synced"}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div className={cn("h-full rounded-full", tone)} animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
      </div>
      <div className="mt-0.5 text-right text-[10px] text-muted-foreground">warning at {STALE_WARNING_SECONDS}s</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono tabular">{value}</dd>
    </div>
  );
}

function PollRow({ entry }: { entry: PollLogEntry }) {
  const s = entry.status;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-2 font-mono text-[11px]"
    >
      <span className={cn("w-9 rounded px-1 text-center text-[10px] font-semibold", STATUS_STYLE[String(s) as keyof typeof STATUS_STYLE])}>
        {s === "error" ? "ERR" : s}
      </span>
      <span className="w-8 text-muted-foreground tabular">{entry.version != null ? `v${entry.version}` : "—"}</span>
      <span className={cn("min-w-0 flex-1 truncate", s === 200 ? "text-foreground" : "text-muted-foreground")}>
        {s === 200 ? "new ruleset, swapped in" : s === 304 ? "nothing changed" : entry.error}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground/70 tabular">{time(entry.at)}</span>
    </motion.li>
  );
}

export function describe(a: AuditView): string {
  const v = (x: unknown) =>
    x && typeof x === "object" && "enabled" in x ? ((x as { enabled: boolean }).enabled ? "ON" : "OFF") : "default";
  const who = a.clientId ? clientName(a.clientId) : "Default";
  switch (a.action) {
    case "default.set":
      return `Default ${v(a.before)} → ${v(a.after)}`;
    case "override.added":
    case "override.updated":
      return `${who} ${v(a.before)} → ${v(a.after)}`;
    case "override.removed":
      return `${who} ${v(a.before)} → default`;
    case "flag.created":
      return "Flag created";
    case "flag.archived":
      return "Flag archived";
    case "flag.updated":
      return "Details edited";
    default:
      return a.action;
  }
}

function AuditRow({ entry: a }: { entry: AuditView }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -8, backgroundColor: "var(--accent)" }}
      animate={{ opacity: 1, y: 0, backgroundColor: "rgba(0,0,0,0)" }}
      transition={{ duration: 0.3, backgroundColor: { duration: 2 } }}
      className="grid grid-cols-[4.25rem_1fr_auto] items-baseline gap-x-2 rounded-md px-1 py-0.5 text-xs"
    >
      <span
        className={cn(
          "w-fit rounded px-1 font-mono text-[10px] font-semibold",
          a.environment === "prod" ? "bg-destructive/12 text-destructive" : "bg-muted text-muted-foreground",
        )}
      >
        {a.environment} v{a.version}
      </span>
      <span className="min-w-0 truncate" title={`${describe(a)} · ${a.flagKey}`}>
        <span className="font-medium">{describe(a)}</span>{" "}
        <code className="font-mono text-[11px] text-muted-foreground">{a.flagKey}</code>
      </span>
      <span className="text-[10px] text-muted-foreground tabular">{time(a.at)}</span>
      <span />
      <span className="col-span-2 truncate text-[11px] text-muted-foreground" title={a.reason}>
        {a.actor}
        {a.reason && <> · “{a.reason}”</>}
      </span>
    </motion.li>
  );
}
