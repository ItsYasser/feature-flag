"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CloudOffIcon, FileTextIcon, MoonIcon, RotateCcwIcon, ServerIcon, SirenIcon, TriangleAlertIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { CLIENTS, type Environment } from "@/lib/domain";
import type { Evaluation } from "@/lib/sdk";
import { cn } from "@/lib/utils";
import { InvoiceCard } from "./invoice-card";
import { OpenLink } from "./open-link";
import { Segmented } from "./segmented";
import { DEMO_POLL_INTERVAL_MS, STALE_WARNING_SECONDS, type FlagService } from "./use-flag-service";
import { Why } from "./why";

/** The flags this service's code checks, with the fallback written at each call site. */
export const CODE_FLAGS = [
  { key: "billing.new_invoice_design", fallback: false, what: "Invoice design" },
  { key: "frontend.dark_mode", fallback: false, what: "Dashboard theme" },
  { key: "billing.pdf_export_v2", fallback: false, what: "PDF export" },
] as const;

const NO_CLIENT: Evaluation = { value: false, source: "fallback", fallbackReason: "no_ruleset" };

export function ServicePanel({
  service,
  env,
  now,
  hoveredClient,
  onOutageChange,
  openHref,
  className,
  gridClassName,
}: {
  service: FlagService;
  env: Environment;
  now: number;
  hoveredClient: string | null;
  onOutageChange(on: boolean): void;
  openHref?: string;
  className?: string;
  gridClassName?: string;
}) {
  const { client, state, outage, setOutage, restart } = service;
  const staleness = client && state ? client.getStalenessSeconds(now) : Infinity;
  const stale = !!state?.hasRuleset && staleness >= STALE_WARNING_SECONDS;
  const booting = !state || (state.pollLog.length === 0 && !state.hasRuleset);
  const noRuleset = !!state && !state.hasRuleset && !booting;
  const emergencyCount = Object.keys(state?.emergencyOverrides ?? {}).length;

  return (
    <section className={cn("flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-xs", className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 pb-2.5">
        <div className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
          <ServerIcon className="size-4" />
        </div>
        <div className="mr-auto">
          <h2 className="flex items-center gap-2 font-semibold tracking-tight">
            billing-service
            <span className="rounded bg-muted px-1.5 py-px font-mono text-[11px] font-normal text-muted-foreground">{env}</span>
          </h2>
          <p className="text-xs text-muted-foreground">Checks flags in memory · refreshes every {DEMO_POLL_INTERVAL_MS / 1000}s</p>
        </div>
        <SyncPill service={service} staleness={staleness} booting={booting} />
        {openHref && <OpenLink href={openHref} />}
      </div>

      {/* Resilience controls */}
      <div className="flex flex-wrap items-center gap-2 border-y bg-muted/30 px-4 py-2">
        <label
          className={cn(
            "flex h-8 cursor-pointer items-center gap-2 rounded-lg border bg-background px-2.5 text-sm transition-colors",
            outage && "border-destructive/50 bg-destructive/10 text-destructive",
          )}
        >
          <Switch
            checked={outage}
            onCheckedChange={(on) => {
              setOutage(on);
              onOutageChange(on);
            }}
            aria-label="Simulate flag API outage"
          />
          <CloudOffIcon className="size-3.5" />
          Flag API outage
        </label>
        <Why>The service keeps its last copy of the flags, so an outage can&apos;t take it down.</Why>

        <Button variant="outline" onClick={restart} className="h-8">
          <RotateCcwIcon /> Restart service
        </Button>
        <Why>A restart clears memory. If the API is down too, the service uses the defaults written in code.</Why>

        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className={cn("h-8", emergencyCount > 0 && "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/15")}
              />
            }
          >
            <SirenIcon /> Emergency override
            {emergencyCount > 0 && (
              <span className="grid size-4 place-items-center rounded-full bg-destructive text-[10px] text-white">{emergencyCount}</span>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[380px]">
            <PopoverHeader>
              <PopoverTitle>Emergency override</PopoverTitle>
              <PopoverDescription>Force a flag on this service. Beats every other rule.</PopoverDescription>
            </PopoverHeader>
            <ul className="mt-1 space-y-2">
              {CODE_FLAGS.map((f) => {
                const current = state?.emergencyOverrides[f.key];
                return (
                  <li key={f.key} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium">{f.what}</div>
                      <code className="block truncate font-mono text-[10px] text-muted-foreground">{f.key}</code>
                    </div>
                    <Segmented
                      id={`emerg-${f.key}`}
                      size="sm"
                      ariaLabel={`Emergency override for ${f.key}`}
                      value={current === undefined ? "none" : current ? "on" : "off"}
                      onChange={(v) => service.setEmergencyOverride(f.key, v === "none" ? null : v === "on")}
                      options={[
                        { value: "none", label: "Off" },
                        { value: "on", label: "ON", tone: "danger" },
                        { value: "off", label: "OFF", tone: "danger" },
                      ]}
                    />
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
        <Why>Set on the service itself, so it works even when the flag API is down.</Why>
      </div>

      {/* Status banners */}
      <AnimatePresence initial={false}>
        {stale && (
          <Banner key="stale" icon={<TriangleAlertIcon className="size-4" />}>
            <b>{Math.floor(staleness)}s since the last update.</b> Still running on v{state?.version}.
          </Banner>
        )}
        {noRuleset && (
          <Banner key="fallback" icon={<CloudOffIcon className="size-4" />}>
            <b>No flags loaded.</b> Using the defaults written in code.
          </Banner>
        )}
      </AnimatePresence>

      {/* Clients */}
      <div className={cn("grid min-h-0 flex-1 auto-rows-[minmax(178px,1fr)] grid-cols-2 gap-3 overflow-y-auto p-3 xl:grid-cols-3", gridClassName)}>
        {CLIENTS.map((c) => (
          <InvoiceCard
            key={c.id}
            client={c}
            highlighted={hoveredClient === c.id}
            flags={{
              newInvoice: client?.evaluate(CODE_FLAGS[0].key, c.id, CODE_FLAGS[0].fallback) ?? NO_CLIENT,
              darkMode: client?.evaluate(CODE_FLAGS[1].key, c.id, CODE_FLAGS[1].fallback) ?? NO_CLIENT,
              pdfV2: client?.evaluate(CODE_FLAGS[2].key, c.id, CODE_FLAGS[2].fallback) ?? NO_CLIENT,
            }}
          />
        ))}
        <Legend />
      </div>
    </section>
  );
}

function Legend() {
  return (
    <div className="flex flex-col justify-center gap-1.5 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
      <div className="mb-1 font-medium text-foreground">Each card = one client</div>
      <div className="flex items-center gap-1.5">
        <FileTextIcon className="size-3.5" /> Invoice design
      </div>
      <div className="flex items-center gap-1.5">
        <MoonIcon className="size-3.5" /> Theme
      </div>
      <div className="flex items-center gap-1.5">
        <ZapIcon className="size-3.5" /> PDF export
      </div>
    </div>
  );
}

export function SyncPill({ service, staleness, booting }: { service: FlagService; staleness: number; booting: boolean }) {
  const { state, outage } = service;
  const last = state?.pollLog[0];
  let tone: "ok" | "warn" | "bad" = "ok";
  let text = "Starting…";
  if (state && !booting) {
    if (!state.hasRuleset) {
      tone = "bad";
      text = "No flags loaded · using fallbacks";
    } else if (last?.status === "error" || outage) {
      tone = "warn";
      text = `Can't reach API · serving v${state.version}`;
    } else {
      text = `In sync · v${state.version} · checked ${Math.floor(staleness)}s ago`;
    }
  }
  const dot = tone === "ok" ? "bg-success" : tone === "warn" ? "bg-warning" : "bg-destructive";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium tabular",
        tone === "ok" && "border-success/30 bg-success/5 text-success",
        tone === "warn" && "border-warning/40 bg-warning/10 text-warning",
        tone === "bad" && "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      <span className="relative flex size-2">
        <motion.span
          key={last?.id ?? 0}
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 2.6, opacity: 0 }}
          transition={{ duration: 0.9 }}
          className={cn("absolute inset-0 rounded-full", dot)}
        />
        <span className={cn("relative size-2 rounded-full", dot)} />
      </span>
      {text}
    </span>
  );
}

function Banner({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
      <div className="flex items-start gap-2 border-b bg-warning/10 px-4 py-2 text-sm">
        <span className="mt-0.5 text-warning">{icon}</span>
        <p>{children}</p>
      </div>
    </motion.div>
  );
}
