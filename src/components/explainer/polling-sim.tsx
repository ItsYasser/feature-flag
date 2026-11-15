"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloudOffIcon, PauseIcon, PlayIcon, ToggleRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A toy model of the read path. One simulated second passes every 200 ms, so a 15 s poll
 * interval plays back as 3 s. Each service polls on its own offset, just like real pods that
 * started at different times.
 */
const TICK_MS = 200;
const POLL_EVERY = 15;
const WINDOW = 75; // seconds visible on the timeline
const SERVICES = [
  { name: "billing-service", offset: 2 },
  { name: "orders-service", offset: 7 },
  { name: "notify-service", offset: 12 },
];
const STALE_ALERT = 300; // 5 minutes, per the design

interface PollEvent {
  t: number;
  status: 200 | 304 | "err";
  version: number;
}
interface SimState {
  t: number;
  serverVersion: number;
  apiDown: boolean;
  downSince: number;
  writes: { t: number; version: number }[];
  services: { version: number; lastSync: number; events: PollEvent[] }[];
  propagation: { version: number; seconds: number } | null;
}

const initial = (): SimState => ({
  t: 0,
  serverVersion: 44,
  apiDown: false,
  downSince: 0,
  writes: [],
  services: SERVICES.map(() => ({ version: 44, lastSync: 0, events: [] })),
  propagation: null,
});

function advance(s: SimState): SimState {
  const t = s.t + 1;
  const services = s.services.map((svc, i) => {
    if ((t - SERVICES[i].offset) % POLL_EVERY !== 0) return svc;
    let ev: PollEvent;
    let next = svc;
    if (s.apiDown) ev = { t, status: "err", version: svc.version };
    else if (svc.version === s.serverVersion) {
      ev = { t, status: 304, version: svc.version };
      next = { ...svc, lastSync: t };
    } else {
      ev = { t, status: 200, version: s.serverVersion };
      next = { ...svc, version: s.serverVersion, lastSync: t };
    }
    return { ...next, events: [...next.events.filter((e) => e.t > t - WINDOW - 5), ev] };
  });

  // When the last service catches up with the newest write, record how long it took.
  let propagation = s.propagation;
  const lastWrite = s.writes[s.writes.length - 1];
  if (lastWrite && services.every((x) => x.version >= lastWrite.version) && propagation?.version !== lastWrite.version) {
    propagation = { version: lastWrite.version, seconds: t - lastWrite.t };
  }
  return { ...s, t, services, propagation, writes: s.writes.filter((w) => w.t > t - WINDOW - 5) };
}

export function PollingSim() {
  const [sim, setSim] = useState<SimState>(initial);
  const [playing, setPlaying] = useState(true);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setSim(advance), TICK_MS);
    return () => clearInterval(id);
  }, [playing]);

  // Pause when scrolled out of view so it doesn't race ahead unseen.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPlaying(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const flip = () =>
    setSim((s) => (s.apiDown ? s : { ...s, serverVersion: s.serverVersion + 1, writes: [...s.writes, { t: s.t, version: s.serverVersion + 1 }] }));
  const toggleApi = () => setSim((s) => ({ ...s, apiDown: !s.apiDown, downSince: s.t }));

  const x = (t: number) => `${((t - (sim.t - WINDOW)) / WINDOW) * 100}%`;
  const pending = sim.writes.length > 0 && sim.services.some((s) => s.version < sim.serverVersion);

  return (
    <div ref={root} className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Button size="sm" onClick={flip} disabled={sim.apiDown}>
          <ToggleRightIcon /> Flip a flag
        </Button>
        <Button size="sm" variant={sim.apiDown ? "destructive" : "outline"} onClick={toggleApi}>
          <CloudOffIcon /> {sim.apiDown ? "Bring the API back" : "Take the API down"}
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular">
          simulated time {Math.floor(sim.t / 60)}:{String(sim.t % 60).padStart(2, "0")} · 1 s = {TICK_MS} ms
        </span>
      </div>

      <div className="grid gap-px bg-border lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="bg-card p-4">
          {/* Server lane */}
          <Lane label="Flag API" sub={sim.apiDown ? "down" : `serving v${sim.serverVersion}`} tone={sim.apiDown ? "bad" : "ok"}>
            {sim.writes.map((w) => (
              <motion.div
                key={w.version}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-1.5 py-px font-mono text-[10px] font-semibold whitespace-nowrap text-primary-foreground"
                style={{ left: x(w.t) }}
              >
                write → v{w.version}
              </motion.div>
            ))}
            {sim.apiDown && (
              <div className="absolute inset-y-1 right-0 rounded bg-destructive/15" style={{ left: x(Math.max(sim.downSince, sim.t - WINDOW)) }} />
            )}
          </Lane>

          {sim.services.map((svc, i) => {
            const stale = sim.t - svc.lastSync;
            return (
              <Lane
                key={SERVICES[i].name}
                label={SERVICES[i].name}
                sub={`holds v${svc.version}`}
                tone={svc.version < sim.serverVersion ? "warn" : "ok"}
                extra={sim.apiDown ? `${stale}s stale` : undefined}
              >
                {svc.events
                  .filter((e) => e.t > sim.t - WINDOW)
                  .map((e) => (
                    <motion.div
                      key={e.t}
                      initial={{ y: -8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className={cn(
                        "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded px-1 font-mono text-[10px] font-semibold",
                        e.status === 304 && "bg-muted text-muted-foreground",
                        e.status === 200 && "bg-success text-white",
                        e.status === "err" && "bg-destructive text-white",
                      )}
                      style={{ left: x(e.t) }}
                      title={`t=${e.t}s`}
                    >
                      {e.status === "err" ? "ERR" : e.status === 200 ? `200 v${e.version}` : "304"}
                    </motion.div>
                  ))}
              </Lane>
            );
          })}

          {/* time axis */}
          <div className="relative mt-1 ml-36 h-4 text-[10px] text-muted-foreground">
            {[0, 15, 30, 45, 60, 75].map((ago) => (
              <span key={ago} className="absolute -translate-x-1/2" style={{ left: `${100 - (ago / WINDOW) * 100}%` }}>
                {ago === 0 ? "now" : `-${ago}s`}
              </span>
            ))}
          </div>
        </div>

        {/* Readout */}
        <div className="space-y-3 bg-muted/20 p-4 text-sm">
          <AnimatePresence mode="wait">
            {sim.apiDown ? (
              <Readout key="down" tone="bad" title="API down: still serving">
                Services keep their last copy. Alert after {STALE_ALERT / 60} min.
              </Readout>
            ) : pending ? (
              <Readout key="pending" tone="warn" title={`v${sim.serverVersion} is on its way…`}>
                Each service picks it up on its next poll.
              </Readout>
            ) : sim.propagation ? (
              <Readout key={`p${sim.propagation.version}`} tone="ok" title={`v${sim.propagation.version} reached every service in ${sim.propagation.seconds}s`}>
                Worst case: one poll interval ({POLL_EVERY}s).
              </Readout>
            ) : (
              <Readout key="idle" tone="idle" title="Nothing has changed">
                Every poll returns an empty <b>304</b>. Try <b>Flip a flag</b>.
              </Readout>
            )}
          </AnimatePresence>
          <dl className="space-y-1 text-xs">
            <Row k="Poll interval" v={`${POLL_EVERY}s per service`} />
            <Row k="Requests / min (3 services)" v={`${(SERVICES.length * 60) / POLL_EVERY}`} />
            <Row k="…for 30 services × 4 pods" v={`${(30 * 4 * 60) / POLL_EVERY}`} />
            <Row k="Cost of a 304" v="1 compare, 0-byte body" />
          </dl>
        </div>
      </div>
    </div>
  );
}

function Lane({
  label,
  sub,
  tone,
  extra,
  children,
}: {
  label: string;
  sub: string;
  tone: "ok" | "warn" | "bad";
  extra?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-33 shrink-0">
        <div className="truncate font-mono text-xs font-medium">{label}</div>
        <div
          className={cn(
            "text-[11px]",
            tone === "ok" && "text-muted-foreground",
            tone === "warn" && "font-medium text-warning",
            tone === "bad" && "font-medium text-destructive",
          )}
        >
          {sub}
          {extra && <span className="text-warning"> · {extra}</span>}
        </div>
      </div>
      <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-muted/40">
        <div className="absolute inset-y-0 right-0 w-px bg-primary/40" />
        {children}
      </div>
    </div>
  );
}

function Readout({ tone, title, children }: { tone: "ok" | "warn" | "bad" | "idle"; title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={cn(
        "rounded-lg border p-3",
        tone === "ok" && "border-success/40 bg-success/10",
        tone === "warn" && "border-warning/40 bg-warning/10",
        tone === "bad" && "border-destructive/40 bg-destructive/10",
        tone === "idle" && "bg-card",
      )}
    >
      <div className="font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{children}</p>
    </motion.div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono tabular">{v}</dd>
    </div>
  );
}
