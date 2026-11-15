"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRightIcon, KeyRoundIcon, LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Column {
  name: string;
  type: string;
  pk?: boolean;
  fk?: boolean;
  note?: string;
}
interface TableDef {
  name: string;
  purpose: string;
  columns: Column[];
  example: string[][];
  tone?: "primary" | "audit" | "version";
}

const TABLES: TableDef[] = [
  {
    name: "flags",
    purpose: "The list of switches",
    tone: "primary",
    columns: [
      { name: "id", type: "serial", pk: true },
      { name: "key", type: "text", note: "unique, immutable" },
      { name: "description", type: "text" },
      { name: "owner_team", type: "text" },
      { name: "status", type: "active | archived" },
      { name: "expires_at", type: "timestamptz?" },
    ],
    example: [
      ["1", "billing.new_invoice_design", "billing", "active"],
      ["2", "frontend.dark_mode", "frontend", "active"],
    ],
  },
  {
    name: "flag_defaults",
    purpose: "Default value per environment",
    columns: [
      { name: "flag_id", type: "int", pk: true, fk: true },
      { name: "environment", type: "dev | staging | prod", pk: true },
      { name: "enabled", type: "bool" },
    ],
    example: [
      ["1", "prod", "false"],
      ["2", "prod", "true"],
    ],
  },
  {
    name: "flag_overrides",
    purpose: "Per-client exceptions",
    columns: [
      { name: "flag_id", type: "int", pk: true, fk: true },
      { name: "environment", type: "env", pk: true },
      { name: "client_id", type: "text", pk: true },
      { name: "enabled", type: "bool" },
      { name: "reason", type: "text" },
      { name: "updated_by", type: "text" },
    ],
    example: [
      ["1", "prod", "client_A", "true"],
      ["2", "prod", "client_C", "false"],
    ],
  },
  {
    name: "audit_log",
    purpose: "Every change, append-only",
    tone: "audit",
    columns: [
      { name: "id", type: "bigserial", pk: true },
      { name: "flag_id", type: "int", fk: true },
      { name: "environment", type: "env" },
      { name: "client_id", type: "text?" },
      { name: "actor", type: "text" },
      { name: "before / after", type: "jsonb" },
      { name: "reason", type: "text" },
      { name: "version", type: "bigint", note: "the version this write produced" },
      { name: "at", type: "timestamptz" },
    ],
    example: [["1042", "aisyah (billing)", "∅ → ON", "v45"]],
  },
  {
    name: "ruleset_version",
    purpose: "Bumped on every write",
    tone: "version",
    columns: [
      { name: "environment", type: "env", pk: true },
      { name: "version", type: "bigint", note: "= the ETag" },
    ],
    example: [
      ["dev", "31"],
      ["prod", "45"],
    ],
  },
];

const JSON_LINES: { text: string; from?: string }[] = [
  { text: "{" },
  { text: '  "env": "prod",' },
  { text: '  "version": 45,', from: "ruleset_version" },
  { text: '  "flags": {' },
  { text: '    "billing.new_invoice_design": {', from: "flags" },
  { text: '      "default": false,', from: "flag_defaults" },
  { text: '      "overrides": { "client_A": true }', from: "flag_overrides" },
  { text: "    }," },
  { text: '    "frontend.dark_mode": {', from: "flags" },
  { text: '      "default": true,', from: "flag_defaults" },
  { text: '      "overrides": { "client_C": false }', from: "flag_overrides" },
  { text: "    }" },
  { text: "  }" },
  { text: "}" },
];

export function DataModel() {
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.6fr)_auto_minmax(0,1fr)] 2xl:items-center">
      {/* ERD cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-2">
        {TABLES.map((t) => (
          <motion.div
            key={t.name}
            onMouseEnter={() => setHover(t.name)}
            onMouseLeave={() => setHover(null)}
            animate={{ scale: hover === t.name ? 1.015 : 1 }}
            className={cn(
              "overflow-hidden rounded-xl border bg-card transition-colors",
              hover === t.name && "border-primary",
              t.name === "audit_log" && "sm:row-span-2",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between gap-2 border-b px-3 py-2",
                t.tone === "primary" && "bg-accent",
                t.tone === "audit" && "bg-warning/10",
                t.tone === "version" && "bg-success/10",
                !t.tone && "bg-muted/50",
              )}
            >
              <code className="font-mono text-sm font-semibold">{t.name}</code>
              <span className="text-[11px] text-muted-foreground">{t.purpose}</span>
            </div>
            <ul className="divide-y text-xs">
              {t.columns.map((c) => (
                <li key={c.name} className="flex items-center gap-2 px-3 py-1">
                  <span className="flex w-8 shrink-0 gap-0.5">
                    {c.pk && <KeyRoundIcon className="size-3 text-warning" aria-label="primary key" />}
                    {c.fk && <LinkIcon className="size-3 text-primary" aria-label="foreign key to flags.id" />}
                  </span>
                  <span className={cn("font-mono", c.pk && "font-semibold")}>{c.name}</span>
                  <span className="ml-auto truncate text-right text-[11px] text-muted-foreground" title={c.note ? `${c.type} · ${c.note}` : c.type}>
                    {c.type}
                    {c.note && <span className="text-foreground/70"> · {c.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t bg-muted/30 px-3 py-2">
              <div className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Seed rows</div>
              {t.example.map((r, i) => (
                <div key={i} className="truncate font-mono text-[11px] text-muted-foreground" title={`(${r.join(", ")})`}>
                  ({r.join(", ")})
                </div>
              ))}
            </div>
          </motion.div>
        ))}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground sm:col-span-2 lg:col-span-3 2xl:col-span-2">
          <span className="flex items-center gap-1">
            <KeyRoundIcon className="size-3 text-warning" /> primary key (several = composite)
          </span>
          <span className="flex items-center gap-1">
            <LinkIcon className="size-3 text-primary" /> foreign key → flags.id
          </span>
          <span>audit_log can&apos;t be edited; keys can&apos;t be renamed.</span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground 2xl:flex-col">
        <span className="max-w-32 text-center">one SQL statement, one snapshot</span>
        <motion.span
          animate={{ x: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          <ArrowRightIcon className="size-5 rotate-90 2xl:rotate-0" />
        </motion.span>
      </div>

      {/* JSON */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
          <code className="font-mono text-xs font-semibold">GET /v1/rulesets/prod</code>
          <span className="text-[11px] text-muted-foreground">what every service holds in memory</span>
        </div>
        <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed">
          {JSON_LINES.map((l, i) => (
            <div
              key={i}
              onMouseEnter={() => l.from && setHover(l.from)}
              onMouseLeave={() => setHover(null)}
              className={cn(
                "rounded px-1 transition-colors",
                l.from && hover === l.from ? "bg-primary/20 text-foreground" : "text-muted-foreground",
                l.from && "cursor-default",
              )}
            >
              {l.text}
            </div>
          ))}
        </pre>
        <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">Hover a line to see its source table.</div>
      </div>
    </div>
  );
}
