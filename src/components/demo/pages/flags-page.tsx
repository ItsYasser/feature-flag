"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArchiveIcon, CalendarClockIcon, LockIcon, ToggleRightIcon } from "lucide-react";
import { ENVIRONMENTS, type Environment } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { AdminPanel } from "../admin-panel";
import { useDemo } from "../demo-context";
import { TeamBadge } from "../identity-picker";
import { PageHeader, Stat } from "../page-header";

const ENV_LABEL: Record<Environment, string> = { dev: "Development", staging: "Staging", prod: "Production" };

export function FlagsPage() {
  const d = useDemo();
  const [showArchived, setShowArchived] = useState(false);
  const active = d.flags?.filter((f) => f.status === "active") ?? [];
  const archived = d.flags?.filter((f) => f.status === "archived") ?? [];
  const selected = active.find((f) => f.key === d.selectedFlag) ?? active[0] ?? null;
  const prodOn = active.filter((f) => f.environments.prod.default).length;

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-5 px-4 py-6">
      <PageHeader
        icon={ToggleRightIcon}
        title="Flags"
        description="Click a cell to edit a flag in that environment."
      >
        <Stat label="Active flags" value={active.length} />
        <Stat label="ON in prod" value={prodOn} />
      </PageHeader>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_440px]">
        {/* Overview table */}
        <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="flex items-center gap-1.5 border-b px-4 py-3">
            <h2 className="font-semibold tracking-tight">All environments</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Flag</th>
                  {ENVIRONMENTS.map((e) => (
                    <th key={e} className={cn("px-3 py-2 font-medium", e === d.env && "text-foreground")}>
                      <span className="flex items-center gap-1.5">
                        {e === "prod" && <span className="size-1.5 rounded-full bg-destructive" />}
                        {ENV_LABEL[e]}
                        {e === d.env && <span className="rounded bg-accent px-1 text-[10px] text-accent-foreground">editing</span>}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Remove by</th>
                </tr>
              </thead>
              <tbody>
                {!d.flags &&
                  [0, 1, 2].map((i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="h-8 animate-pulse rounded bg-muted/60" />
                      </td>
                    </tr>
                  ))}
                {active.map((f) => {
                  const isSel = f.key === selected?.key;
                  const owned = f.ownerTeam === d.actor.team;
                  return (
                    <tr key={f.key} className={cn("border-b transition-colors last:border-0", isSel ? "bg-accent/50" : "hover:bg-muted/40")}>
                      <td className="relative px-4 py-3 align-top">
                        {isSel && <motion.span layoutId="flags-row" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
                        <button onClick={() => d.setSelectedFlag(f.key)} className="text-left">
                          <span className="flex items-center gap-1.5">
                            <code className="font-mono text-[13px] font-semibold">{f.key}</code>
                            {!owned && <LockIcon className="size-3 text-muted-foreground" aria-label="Owned by another team" />}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block max-w-md text-xs text-muted-foreground">{f.description}</span>
                        </button>
                      </td>
                      {ENVIRONMENTS.map((e) => {
                        const cfg = f.environments[e];
                        const editing = isSel && e === d.env;
                        return (
                          <td key={e} className="px-2 py-2 align-top">
                            <button
                              onClick={() => {
                                d.setSelectedFlag(f.key);
                                d.setEnv(e);
                              }}
                              title={`Edit ${f.key} in ${ENV_LABEL[e]}`}
                              className={cn(
                                "flex w-full flex-col items-start gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors hover:border-primary/50",
                                editing ? "border-primary bg-card ring-2 ring-primary/20" : "border-transparent",
                              )}
                            >
                              <span
                                className={cn(
                                  "rounded-md px-1.5 py-px font-mono text-[11px] font-semibold whitespace-nowrap",
                                  cfg.default ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                                )}
                              >
                                {cfg.default ? "ON" : "OFF"}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {cfg.overrides.length > 0 && `+${cfg.overrides.length} override${cfg.overrides.length > 1 ? "s" : ""}`}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 align-top">
                        <TeamBadge team={f.ownerTeam} />
                      </td>
                      <td className="px-3 py-3 align-top text-xs whitespace-nowrap text-muted-foreground">
                        {f.expiresAt ? (
                          <span className="flex items-center gap-1">
                            <CalendarClockIcon className="size-3" />
                            {new Date(f.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {archived.length > 0 && (
            <div className="border-t px-4 py-2.5">
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowArchived((s) => !s)}>
                <ArchiveIcon className="size-3.5" />
                {showArchived ? "Hide" : "Show"} {archived.length} archived flag{archived.length > 1 ? "s" : ""}
              </button>
              {showArchived && (
                <ul className="mt-2 space-y-1">
                  {archived.map((f) => (
                    <li key={f.key} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <code className="font-mono line-through">{f.key}</code>
                      <TeamBadge team={f.ownerTeam} />
                      <span>removed from every ruleset; code that checks it gets its fallback</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Editor */}
        <div className="lg:sticky lg:top-16 lg:grid lg:h-[calc(100dvh-5.5rem)]">
          <AdminPanel
            title={`Edit in ${ENV_LABEL[d.env].toLowerCase()}`}
            hideList
            actor={d.actor}
            env={d.env}
            flags={d.flags}
            loadError={d.flagsError}
            onWritten={d.onWritten}
            onForbidden={() => d.mark("forbidden")}
            onHoverClient={d.setHoveredClient}
            onChanged={d.reloadFlags}
            selectedKey={selected?.key ?? null}
            onSelect={d.setSelectedFlag}
          />
        </div>
      </div>
    </div>
  );
}
