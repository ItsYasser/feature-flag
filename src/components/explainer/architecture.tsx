"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Segmented } from "./segmented";
import { cn } from "@/lib/utils";

type Mode = "read" | "write" | "outage";

const STEPS: Record<Mode, { title: string; steps: string[] }> = {
  read: {
    title: "Nothing changed",
    steps: [
      "Every 15 s, each service asks: “anything newer than v44?”",
      "The API answers 304 from memory. No database hit.",
      "Client requests are checked in memory, in under 50 µs.",
    ],
  },
  write: {
    title: "A flag changes",
    steps: [
      "The API checks the team owns the flag and that prod changes have a reason.",
      "One transaction saves the change, the audit row and v45.",
      "Each service's next poll gets 200 with v45.",
    ],
  },
  outage: {
    title: "API is down",
    steps: [
      "Polls fail; services keep their last copy.",
      "Client requests are unaffected.",
      "On-call can still force a flag with an env var.",
    ],
  },
};

// Geometry ------------------------------------------------------------------------------------
const SVC_X = [60, 330, 600];
const SVC_NAMES = ["billing-service", "orders-service", "notify-service"];
const pollPath = (i: number) => `M${SVC_X[i] + 100},280 C${SVC_X[i] + 100},240 360,250 360,204`;
const pollPathBack = (i: number) => `M360,204 C360,250 ${SVC_X[i] + 100},240 ${SVC_X[i] + 100},280`;
const halfPoll = (i: number) => `M${SVC_X[i] + 100},280 C${SVC_X[i] + 100},262 ${(SVC_X[i] + 100 + 360) / 2},250 ${(SVC_X[i] + 100 + 360) / 2},243`;

export function Architecture() {
  const [mode, setMode] = useState<Mode>("read");
  const down = mode === "outage";

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <Segmented
          id="arch-mode"
          ariaLabel="Scenario"
          value={mode}
          onChange={setMode}
          options={[
            { value: "read", label: "Normal polling", tone: "accent" },
            { value: "write", label: "A flag changes", tone: "accent" },
            { value: "outage", label: "Flag API down", tone: "danger" },
          ]}
        />
        <span className="text-sm text-muted-foreground">{STEPS[mode].title}</span>
      </div>

      <div className="grid 2xl:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto p-4">
          <svg viewBox="0 0 960 430" className="min-w-[680px]" role="img" aria-label={`Architecture: ${STEPS[mode].title}`}>
            {/* static edges */}
            <g className="fill-none stroke-border" strokeWidth={2}>
              <path d="M170,72 L260,72" />
              <path d="M460,72 L560,72" />
              <path d="M645,104 L645,177 L460,177" strokeDasharray="4 4" />
              <path d="M360,104 L360,150" strokeDasharray="4 4" />
              {SVC_X.map((_, i) => (
                <path key={i} d={pollPath(i)} />
              ))}
              {SVC_X.map((x, i) => (
                <path key={`c${i}`} d={`M${x + 100},405 L${x + 100},350`} />
              ))}
              <path d="M850,315 L800,315" />
            </g>

            {/* edge labels */}
            <g className="fill-muted-foreground text-[11px]">
              <text x="215" y="62" textAnchor="middle">writes</text>
              <text x="510" y="62" textAnchor="middle">1 transaction</text>
              <text x="655" y="145">rebuild once</text>
              <text x="372" y="132">serves</text>
              <text x="470" y="262">poll every 15 s · ETag</text>
            </g>

            {/* nodes */}
            <Node x={20} y={40} w={150} title="Owning team" sub="admin console / CLI" />
            <Node x={260} y={40} w={200} title="Flag API ×2" sub="auth · validation · audit" dead={down} />
            <Node x={560} y={40} w={170} title="PostgreSQL" sub="flags · audit_log · version" />
            <Node x={260} y={150} w={200} h={54} title={mode === "read" ? "Cached ruleset v44" : "Cached ruleset v45"} sub="in API memory" accent dead={down} />
            {SVC_X.map((x, i) => (
              <Node
                key={SVC_NAMES[i]}
                x={x}
                y={280}
                w={200}
                h={70}
                title={SVC_NAMES[i]}
                sub={mode === "read" ? "SDK · v44 in memory" : mode === "write" ? "SDK · v44 → v45" : "SDK · serving v45 (stale)"}
                tone={down ? "warning" : undefined}
              />
            ))}
            {SVC_X.map((x, i) => (
              <text key={`cl${i}`} x={x + 100} y={422} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                client requests → isEnabled()
              </text>
            ))}
            <Node x={850} y={286} w={100} h={58} title="On-call" sub="env var" tone={down ? "danger" : "muted"} small />

            {down && (
              <g>
                <line x1="270" y1="48" x2="450" y2="196" className="stroke-destructive" strokeWidth={3} strokeLinecap="round" />
                <line x1="450" y1="48" x2="270" y2="196" className="stroke-destructive" strokeWidth={3} strokeLinecap="round" />
              </g>
            )}

            {/* moving packets */}
            <AnimatePresence mode="wait">
              <motion.g key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                {mode === "read" &&
                  SVC_X.map((_, i) => (
                    <g key={i}>
                      <Packet path={pollPath(i)} dur={1.2} begin={i * 0.9} repeat={3.6} className="fill-primary" />
                      <Packet path={pollPathBack(i)} dur={1.2} begin={i * 0.9 + 1.2} repeat={3.6} className="fill-muted-foreground" label="304" />
                    </g>
                  ))}
                {mode === "read" && SVC_X.map((x, i) => <Packet key={`r${i}`} path={`M${x + 100},405 L${x + 100},350`} dur={0.5} begin={i * 0.3} repeat={1.1} className="fill-success" r={4} />)}

                {mode === "write" && (
                  <>
                    <Packet path="M170,72 L260,72" dur={0.8} begin={0} repeat={6} className="fill-primary" label="PUT" />
                    <Packet path="M460,72 L560,72" dur={0.8} begin={0.9} repeat={6} className="fill-primary" label="BEGIN…COMMIT" />
                    <Packet path="M645,104 L645,177 L460,177" dur={0.9} begin={1.8} repeat={6} className="fill-primary" label="v45" />
                    {SVC_X.map((_, i) => (
                      <g key={i}>
                        <Packet path={pollPath(i)} dur={0.9} begin={2.8 + i * 0.6} repeat={6} className="fill-primary" />
                        <Packet path={pollPathBack(i)} dur={0.9} begin={3.7 + i * 0.6} repeat={6} className="fill-success" label="200 v45" />
                      </g>
                    ))}
                  </>
                )}

                {mode === "outage" && (
                  <>
                    {SVC_X.map((x, i) => (
                      <g key={i}>
                        <Packet path={halfPoll(i)} dur={0.8} begin={i * 0.7} repeat={2.4} className="fill-destructive" fade />
                        <text x={(x + 100 + 360) / 2} y={238} textAnchor="middle" className="fill-destructive text-[13px] font-bold">
                          ✕
                        </text>
                        <Packet path={`M${x + 100},405 L${x + 100},350`} dur={0.5} begin={i * 0.3} repeat={1.1} className="fill-success" r={4} />
                      </g>
                    ))}
                    <Packet path="M850,315 L800,315" dur={0.6} begin={0} repeat={2} className="fill-destructive" label="force" />
                  </>
                )}
              </motion.g>
            </AnimatePresence>
          </svg>
        </div>

        <div className="border-t bg-muted/30 p-5 2xl:border-t-0 2xl:border-l">
          <AnimatePresence mode="wait">
            <motion.ol
              key={mode}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {STEPS[mode].steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      down ? "bg-destructive/15 text-destructive" : "bg-accent text-accent-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="text-pretty">{s}</span>
                </li>
              ))}
            </motion.ol>
          </AnimatePresence>
          <div className="mt-6 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <LegendDot className="bg-primary">request</LegendDot>
            <LegendDot className="bg-muted-foreground">304 empty</LegendDot>
            <LegendDot className="bg-success">200 / served</LegendDot>
            <LegendDot className="bg-destructive">failed</LegendDot>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} />
      {children}
    </span>
  );
}

function Node({
  x,
  y,
  w,
  h = 64,
  title,
  sub,
  accent,
  dead,
  tone,
  small,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  title: string;
  sub: string;
  accent?: boolean;
  dead?: boolean;
  tone?: "warning" | "danger" | "muted";
  small?: boolean;
}) {
  return (
    <g className={cn("transition-opacity duration-300", dead && "opacity-40")}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        className={cn(
          "fill-card stroke-border transition-colors duration-300",
          accent && "fill-accent stroke-primary/40",
          tone === "warning" && "stroke-warning",
          tone === "danger" && "fill-destructive/10 stroke-destructive",
        )}
        strokeWidth={1.5}
      />
      <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" className={cn("fill-foreground font-semibold", small ? "text-[12px]" : "text-[14px]")}>
        {title}
      </text>
      <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" className="fill-muted-foreground text-[11px]">
        {sub}
      </text>
    </g>
  );
}

/** A dot travelling along a path, repeating every `repeat` seconds. Uses native SVG animateMotion. */
function Packet({
  path,
  dur,
  begin,
  repeat,
  className,
  label,
  r = 6,
}: {
  path: string;
  dur: number;
  begin: number;
  repeat: number;
  className: string;
  label?: string;
  r?: number;
  /** Visual hint only: failed requests are drawn to the midpoint of the edge. */
  fade?: boolean;
}) {
  // Express "travel for `dur`, then wait" as one animation of length `repeat` using keyTimes.
  const end = Math.min(1, dur / repeat);
  const common = {
    dur: `${repeat}s`,
    begin: `${begin}s`,
    repeatCount: "indefinite",
    keyPoints: "0;1;1",
    keyTimes: `0;${end.toFixed(3)};1`,
    calcMode: "linear" as const,
    path,
  };
  return (
    <g opacity={0}>
      <animate attributeName="opacity" values="1;0" keyTimes={`0;${end.toFixed(3)}`} dur={`${repeat}s`} begin={`${begin}s`} repeatCount="indefinite" calcMode="discrete" />
      <circle r={r} className={className}>
        <animateMotion {...common} />
      </circle>
      {label && (
        <text className={cn("text-[10px] font-semibold", className)} dy={-10} textAnchor="middle">
          <animateMotion {...common} />
          {label}
        </text>
      )}
    </g>
  );
}
