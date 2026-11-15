"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownIcon, CheckIcon } from "lucide-react";
import { Segmented } from "./segmented";
import { evaluateFlag, type CompiledFlag } from "@/lib/sdk/evaluate";
import type { EvaluationSource } from "@/lib/sdk/types";
import { cn } from "@/lib/utils";

type Tri = "none" | "on" | "off";
const FLAG = "billing.new_invoice_design";
const CLIENT = "client_A";

const RUNGS: { source: EvaluationSource | "lookup"; title: string; where: string; line: number }[] = [
  { source: "emergency_override", title: "Emergency override", where: "env var on this service", line: 1 },
  { source: "lookup", title: "Is the flag in memory?", where: "ruleset loaded and key known", line: 3 },
  { source: "client_override", title: "Client override", where: "flag_overrides for client_A", line: 7 },
  { source: "env_default", title: "Environment default", where: "flag_defaults for prod", line: 9 },
];

const CODE = [
  "function isEnabled(flagKey, clientId, fallback):",
  "    if emergencyOverride exists for flagKey:       # local env var, highest priority",
  "        return emergencyOverride",
  "    if ruleset is empty or flagKey not in ruleset:  # no copy yet, or unknown flag",
  "        log warning",
  "        return fallback",
  "    flag = ruleset[flagKey]",
  "    if clientId in flag.overrides:                 # client exception wins",
  "        return flag.overrides[clientId]",
  "    return flag.default                            # otherwise environment default",
];

export function EvaluationPlayground() {
  const [emergency, setEmergency] = useState<Tri>("none");
  const [loaded, setLoaded] = useState<"yes" | "no">("yes");
  const [known, setKnown] = useState<"yes" | "no">("yes");
  const [override, setOverride] = useState<Tri>("on");
  const [def, setDef] = useState<"on" | "off">("off");
  const [fallback, setFallback] = useState<"on" | "off">("off");

  // Build an in-memory ruleset from the controls and run the REAL SDK evaluation on it.
  const result = useMemo(() => {
    const flag: CompiledFlag = {
      default: def === "on",
      overrides: new Map(override === "none" ? [] : [[CLIENT, override === "on"]]),
    };
    const ruleset = loaded === "no" ? null : new Map(known === "yes" ? [[FLAG, flag]] : []);
    const em = new Map(emergency === "none" ? [] : [[FLAG, emergency === "on"]]);
    return evaluateFlag(ruleset, em, FLAG, CLIENT, fallback === "on");
  }, [emergency, loaded, known, override, def, fallback]);

  const winner: EvaluationSource = result.source;
  const winnerLine = { emergency_override: 2, fallback: 5, client_override: 8, env_default: 9 }[winner];

  // Status of each rung on the ladder
  const rungStatus = (r: (typeof RUNGS)[number]): { state: "win" | "skip" | "pass" | "unreached" | "fail"; note: string } => {
    const order = ["emergency_override", "lookup", "client_override", "env_default"];
    const idx = order.indexOf(r.source);
    const winIdx = winner === "fallback" ? 1 : order.indexOf(winner);
    if (idx > winIdx) return { state: "unreached", note: "never checked" };
    if (r.source === "emergency_override") return emergency === "none" ? { state: "skip", note: "not set" } : { state: "win", note: `set to ${emergency.toUpperCase()}` };
    if (r.source === "lookup")
      return winner === "fallback"
        ? { state: "fail", note: loaded === "no" ? "no copy in memory yet" : "unknown or archived key, so log a warning" }
        : { state: "pass", note: "found" };
    if (r.source === "client_override") return override === "none" ? { state: "skip", note: "no override for client_A" } : { state: "win", note: `client_A → ${override.toUpperCase()}` };
    return { state: "win", note: `prod default is ${def.toUpperCase()}` };
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="grid gap-px bg-border lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Controls */}
        <div className="space-y-3 bg-card p-4">
          <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Set up the situation</div>
          <Control label="Emergency override (env var)">
            <Segmented id="pg-em" size="sm" ariaLabel="Emergency override" value={emergency} onChange={setEmergency} options={tri("danger")} />
          </Control>
          <Control label="Ruleset in memory">
            <Segmented id="pg-loaded" size="sm" ariaLabel="Ruleset loaded" value={loaded} onChange={setLoaded} options={[{ value: "yes", label: "Loaded" }, { value: "no", label: "Empty (fresh start, API down)" }]} />
          </Control>
          <Control label={`Is ${FLAG} in it?`}>
            <Segmented id="pg-known" size="sm" ariaLabel="Flag known" value={known} onChange={setKnown} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No (typo or archived)" }]} />
          </Control>
          <Control label="Override for client_A">
            <Segmented id="pg-ov" size="sm" ariaLabel="Client override" value={override} onChange={setOverride} options={tri("accent")} />
          </Control>
          <Control label="prod default">
            <Segmented id="pg-def" size="sm" ariaLabel="Default" value={def} onChange={setDef} options={[{ value: "off", label: "OFF", tone: "off" }, { value: "on", label: "ON", tone: "on" }]} />
          </Control>
          <Control label="Fallback written in code">
            <Segmented id="pg-fb" size="sm" ariaLabel="Fallback" value={fallback} onChange={setFallback} options={[{ value: "off", label: "false", tone: "off" }, { value: "on", label: "true", tone: "on" }]} />
          </Control>
        </div>

        {/* Ladder */}
        <div className="bg-muted/20 p-4">
          <div className="mb-3 font-mono text-xs break-all text-muted-foreground">
            flags.isEnabled(&quot;{FLAG}&quot;, &quot;{CLIENT}&quot;, {fallback === "on" ? "true" : "false"})
          </div>
          <ol className="space-y-1.5">
            {RUNGS.map((r, i) => {
              const s = rungStatus(r);
              return (
                <li key={r.title}>
                  <motion.div
                    layout
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors duration-300",
                      s.state === "win" && "border-primary bg-accent",
                      s.state === "fail" && "border-warning/50 bg-warning/10",
                      s.state === "unreached" && "opacity-40",
                      (s.state === "skip" || s.state === "pass") && "bg-card",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                        s.state === "win" ? "bg-primary text-primary-foreground" : s.state === "fail" ? "bg-warning text-white" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {s.state === "win" ? <CheckIcon className="size-3.5" strokeWidth={3} /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{r.title}</div>
                      <div className="text-[11px] text-muted-foreground">{r.where}</div>
                    </div>
                    <span
                      className={cn(
                        "text-right text-[11px]",
                        s.state === "win" ? "font-semibold text-primary" : s.state === "fail" ? "font-medium text-warning" : "text-muted-foreground",
                      )}
                    >
                      {s.note}
                    </span>
                  </motion.div>
                  {i < RUNGS.length - 1 && s.state !== "win" && s.state !== "fail" && s.state !== "unreached" && (
                    <ArrowDownIcon className="mx-auto my-0.5 size-3.5 text-muted-foreground/60" />
                  )}
                </li>
              );
            })}
          </ol>
          {winner === "fallback" && (
            <div className="mt-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
              <span className="font-medium">Use the fallback in code</span>{" "}
              <span className="text-muted-foreground">({fallback === "on" ? "true" : "false"})</span>
            </div>
          )}
        </div>

        {/* Result + code */}
        <div className="grid gap-4 bg-card p-4 lg:col-span-2 2xl:col-span-1">
          <div className="flex items-center gap-4">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={`${result.value}-${winner}`}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={cn(
                  "grid size-20 place-items-center rounded-2xl font-mono text-2xl font-bold",
                  result.value ? "bg-success text-white" : "bg-foreground/85 text-background",
                )}
              >
                {result.value ? "ON" : "OFF"}
              </motion.div>
            </AnimatePresence>
            <div>
              <div className="text-sm text-muted-foreground">Nusantara Logistics (client_A) sees</div>
              <div className="text-lg font-semibold">{result.value ? "the new invoice" : "the classic invoice"}</div>
              <div className="text-xs text-muted-foreground">
                decided by <b className="text-foreground">{label(winner)}</b>
              </div>
            </div>
          </div>
          <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-[11px] leading-relaxed">
            {CODE.map((l, i) => (
              <div
                key={i}
                className={cn(
                  "rounded px-1 transition-colors duration-300",
                  i === winnerLine ? "bg-primary/20 font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {l}
              </div>
            ))}
          </pre>
          <p className="text-xs text-muted-foreground">Runs the real SDK function.</p>
        </div>
      </div>
    </div>
  );
}

function tri(tone: "danger" | "accent") {
  return [
    { value: "none" as const, label: "None" },
    { value: "on" as const, label: "ON", tone },
    { value: "off" as const, label: "OFF", tone },
  ];
}

function label(s: EvaluationSource) {
  return { emergency_override: "the emergency override", client_override: "client_A's override", env_default: "the prod default", fallback: "the in-code fallback" }[s];
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium">{label}</div>
      {children}
    </div>
  );
}
