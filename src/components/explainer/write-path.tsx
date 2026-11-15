"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Request arrives", body: "Aisyah (billing) turns the new invoice ON for client_B in prod." },
  { title: "Checks", body: "Right team? Reason given? If not, stop with 403 or 400." },
  { title: "Change the override", body: "Not visible to anyone yet." },
  { title: "Bump the version", body: "prod goes from 44 to 45." },
  { title: "Append to audit_log", body: "Who, what, why, and the new version." },
  { title: "Commit", body: "All three become visible at once." },
] as const;

const SQL = [
  { step: 2, text: "BEGIN;" },
  { step: 2, text: "SELECT … FROM flags WHERE key = 'billing.new_invoice_design' FOR UPDATE;" },
  { step: 2, text: "INSERT INTO flag_overrides (…, client_id, enabled) VALUES (…, 'client_B', true);" },
  { step: 3, text: "UPDATE ruleset_version SET version = version + 1 WHERE environment = 'prod' RETURNING version; -- 45" },
  { step: 4, text: "INSERT INTO audit_log (actor, action, before, after, reason, version) VALUES (…, 45);" },
  { step: 5, text: "COMMIT;" },
];

export function WritePath() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fail, setFail] = useState(false);
  const last = STEPS.length - 1;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setStep((s) => (s >= last ? 0 : s + 1)), 2600);
    return () => clearInterval(id);
  }, [playing, last]);

  const failed = fail && step >= 4; // the audit insert blows up
  const committed = step === last && !fail;
  const rolledBack = step === last && fail;

  const state = (from: number) => (rolledBack ? "gone" : step < from ? "absent" : committed ? "committed" : failed && from < 4 ? "doomed" : "pending");

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {/* Stepper */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Previous step" onClick={() => (setPlaying(false), setStep((s) => Math.max(0, s - 1)))}>
            <ChevronLeftIcon />
          </Button>
          <Button size="icon-sm" variant="outline" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Next step" onClick={() => (setPlaying(false), setStep((s) => Math.min(last, s + 1)))}>
            <ChevronRightIcon />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Restart" onClick={() => setStep(0)}>
            <RotateCcwIcon />
          </Button>
        </div>
        <ol className="flex flex-1 flex-wrap gap-1">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <button
                onClick={() => (setPlaying(false), setStep(i))}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  i === step && (fail && i >= 4 ? "border-destructive bg-destructive/10 text-destructive" : "border-primary bg-accent text-accent-foreground"),
                  i < step && "text-foreground",
                  i > step && "text-muted-foreground",
                )}
              >
                <span className="font-mono tabular">{i + 1}</span>
                {i === last && fail ? "Rollback" : s.title}
              </button>
            </li>
          ))}
        </ol>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch size="sm" checked={fail} onCheckedChange={setFail} />
          Make the audit insert fail
        </label>
      </div>

      <div className="grid gap-px bg-border lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        {/* Narrative + SQL */}
        <div className="flex flex-col gap-4 bg-card p-5">
          <AnimatePresence mode="wait">
            <motion.div key={`${step}-${fail}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <div className={cn("text-lg font-semibold", (failed || rolledBack) && "text-destructive")}>
                {rolledBack ? "Rollback: nothing happened" : failed ? "The audit insert fails" : STEPS[step].title}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {rolledBack
                  ? "The override and version bump are undone too. No change ever exists without its audit row."
                  : failed
                    ? "The whole transaction will be undone."
                    : STEPS[step].body}
              </p>
            </motion.div>
          </AnimatePresence>

          {step <= 1 ? (
            <div className="rounded-lg border bg-muted/40 p-3 font-mono text-xs">
              <div>
                <span className="font-semibold text-primary">PUT</span> /api/v1/flags/billing.new_invoice_design/env/prod/clients/client_B
              </div>
              <div className="mt-1 text-muted-foreground">x-acting-user: aisyah · x-acting-team: billing</div>
              <div className="mt-1">{`{ "enabled": true, "reason": "Pilot customer for the new invoice" }`}</div>
              {step === 1 && (
                <ul className="mt-3 space-y-1 font-sans">
                  {["Signed in as aisyah (team billing)", "billing owns billing.new_invoice_design", "prod change has a reason", "body is valid (Zod)"].map((c, i) => (
                    <motion.li key={c} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.25 }} className="flex items-center gap-2">
                      <span className="grid size-4 place-items-center rounded-full bg-success text-white">
                        <CheckIcon className="size-3" strokeWidth={3} />
                      </span>
                      {c}
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <pre className="rounded-lg border bg-muted/40 p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
              {SQL.map((l, i) => {
                const isCommit = l.step === 5;
                const active = l.step === step && !(isCommit && fail);
                const done = l.step < step && !(fail && l.step === 4);
                const broke = fail && l.step === 4 && step >= 4;
                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded px-1 transition-colors",
                      active && "bg-primary/15 text-foreground",
                      done && "text-foreground/80",
                      !active && !done && "text-muted-foreground/50",
                      broke && "bg-destructive/15 text-destructive line-through",
                    )}
                  >
                    {isCommit && fail && step === last ? <span className="text-destructive">ROLLBACK;</span> : l.text}
                  </div>
                );
              })}
            </pre>
          )}
        </div>

        {/* Tables */}
        <div className="space-y-3 bg-muted/20 p-5">
          <MiniTable
            name="flag_overrides"
            cols={["flag", "env", "client_id", "enabled", "reason"]}
            rows={[
              { cells: ["new_invoice_design", "prod", "client_A", "ON", "Pilot customer"], state: "committed" as const, quiet: true },
              { cells: ["new_invoice_design", "prod", "client_B", "ON", "Pilot customer for…"], state: state(2) },
            ]}
          />
          <MiniTable
            name="ruleset_version"
            cols={["environment", "version"]}
            rows={[
              { cells: ["dev", "31"], state: "committed" as const, quiet: true },
              {
                cells: ["prod", state(3) === "absent" || state(3) === "gone" ? "44" : "44 → 45"],
                state: state(3) === "absent" || state(3) === "gone" ? ("committed" as const) : state(3),
                quiet: state(3) === "absent" || state(3) === "gone",
              },
            ]}
          />
          <MiniTable
            name="audit_log"
            note="append-only"
            cols={["id", "actor", "change", "reason", "version"]}
            rows={[
              { cells: ["1041", "budi (frontend)", "Batik Prima default → OFF", "Brand request", "44"], state: "committed" as const, quiet: true },
              { cells: ["1042", "aisyah (billing)", "Kopi Kenangan ∅ → ON", "Pilot customer…", "45"], state: fail && step >= 4 ? (rolledBack ? "gone" : "error") : state(4) },
            ]}
          />
          <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
            <Key className="border-dashed border-warning bg-warning/10">uncommitted (invisible to others)</Key>
            <Key className="border-success bg-success/10">committed</Key>
            <Key className="border-destructive bg-destructive/10">failed / rolled back</Key>
          </div>
        </div>
      </div>
    </div>
  );
}

type RowState = "absent" | "pending" | "committed" | "doomed" | "error" | "gone";

function MiniTable({
  name,
  note,
  cols,
  rows,
}: {
  name: string;
  note?: string;
  cols: string[];
  rows: { cells: string[]; state: RowState; quiet?: boolean }[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-1.5">
        <code className="font-mono text-xs font-semibold">{name}</code>
        {note && <span className="text-[10px] text-muted-foreground">{note}</span>}
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-muted-foreground">
            {cols.map((c) => (
              <th key={c} className="px-3 py-1 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {rows
              .filter((r) => r.state !== "absent")
              .map((r) => (
                <motion.tr
                  key={r.cells[0] + r.cells[2]}
                  layout
                  initial={{ opacity: 0, backgroundColor: "rgba(0,0,0,0)" }}
                  animate={{ opacity: r.state === "gone" ? 0.35 : 1 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "border-t font-mono transition-colors duration-300",
                    r.quiet && "text-muted-foreground",
                    r.state === "pending" && "bg-warning/10 outline outline-1 -outline-offset-1 outline-dashed outline-warning",
                    r.state === "doomed" && "bg-destructive/5 outline outline-1 -outline-offset-1 outline-dashed outline-destructive/60",
                    r.state === "committed" && !r.quiet && "bg-success/10",
                    r.state === "error" && "bg-destructive/15 text-destructive",
                    r.state === "gone" && "line-through",
                  )}
                >
                  {r.cells.map((c, i) => (
                    <td key={i} className="truncate px-3 py-1.5">
                      {r.state === "error" && i === 0 ? (
                        <span className="flex items-center gap-1">
                          <XIcon className="size-3" />
                          {c}
                        </span>
                      ) : (
                        c
                      )}
                    </td>
                  ))}
                </motion.tr>
              ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}

function Key({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-sm border", className)} />
      {children}
    </span>
  );
}
