"use client";

import { useEffect, useState } from "react";
import { BracesIcon, CodeXmlIcon, ServerIcon } from "lucide-react";
import type { RulesetPayload } from "@/lib/sdk";
import { useDemo } from "../demo-context";
import { PageHeader, Stat } from "../page-header";
import { CODE_FLAGS, ServicePanel } from "../service-panel";
import { UnderTheHood } from "../under-the-hood";
import { DEMO_POLL_INTERVAL_MS, STALE_WARNING_SECONDS } from "../use-flag-service";

export function ServicesPage() {
  const d = useDemo();
  const state = d.service.state;
  const staleness = d.service.client && state ? d.service.client.getStalenessSeconds(d.now) : Infinity;
  const log = state?.pollLog ?? [];
  const count = (s: 200 | 304 | "error") => log.filter((e) => e.status === s).length;

  // Show the exact JSON the SDK downloaded whenever its version changes.
  const [ruleset, setRuleset] = useState<RulesetPayload | null>(null);
  const version = state?.version ?? null;
  useEffect(() => {
    if (version === null) return;
    let cancelled = false;
    fetch(`/api/v1/rulesets/${d.env}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && setRuleset(j))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [d.env, version]);

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-5 px-4 py-6">
      <PageHeader
        icon={ServerIcon}
        title="Services"
        description="A demo service using the real SDK. Flags are checked in memory."
      >
        <Stat label="Ruleset in memory" value={version !== null ? `v${version}` : "—"} />
        <Stat
          label="Staleness"
          value={Number.isFinite(staleness) ? `${Math.floor(staleness)}s` : "never"}
          tone={!Number.isFinite(staleness) ? "bad" : staleness >= STALE_WARNING_SECONDS ? "warn" : undefined}
        />
        <Stat label="Polls 200 / 304 / err" value={`${count(200)} / ${count(304)} / ${count("error")}`} />
      </PageHeader>

      <ServicePanel
        service={d.service}
        env={d.env}
        now={d.now}
        hoveredClient={null}
        onOutageChange={(on) => on && d.mark("outage")}
        className="min-h-[560px]"
        gridClassName="lg:grid-cols-3"
      />

      <UnderTheHood service={d.service} now={d.now} audit={d.audit?.slice(0, 40) ?? null} auditHref="/audit" className="lg:h-[300px]" />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="flex items-center gap-1.5 border-b px-4 py-3">
            <CodeXmlIcon className="size-4 text-muted-foreground" />
            <h2 className="font-semibold tracking-tight">In the service&apos;s code</h2>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
            <span className="text-muted-foreground">{"// once, at startup"}</span>
            {`\nconst flags = createFlagClient({\n  baseUrl: "https://flags.sistemsaya.internal",\n  env: "${d.env}",\n  pollIntervalMs: ${DEMO_POLL_INTERVAL_MS},  `}
            <span className="text-muted-foreground">{"// 15000 in production"}</span>
            {`\n});\n\n`}
            <span className="text-muted-foreground">{"// on every request: a lookup in memory, no network"}</span>
            {CODE_FLAGS.map(
              (f) => `\nflags.isEnabled("${f.key}", clientId, ${f.fallback});`,
            ).join("")}
          </pre>
        </section>

        <section className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="flex items-center gap-1.5 border-b px-4 py-3">
            <BracesIcon className="size-4 text-muted-foreground" />
            <h2 className="font-semibold tracking-tight">What the SDK downloaded</h2>
            <code className="ml-auto font-mono text-[11px] text-muted-foreground">GET /api/v1/rulesets/{d.env}</code>
          </div>
          <pre className="max-h-[340px] flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
            {ruleset ? <JsonView value={ruleset} /> : <span className="text-muted-foreground">Waiting for the first 200…</span>}
          </pre>
          {ruleset && (
            <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
              ETag <code className="font-mono">&quot;{ruleset.version}&quot;</code> · {new Blob([JSON.stringify(ruleset)]).size} bytes. Later polls send this ETag and get an
              empty 304 until something changes.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Tiny syntax-coloured JSON printer. */
function JsonView({ value, indent = 0 }: { value: unknown; indent?: number }): React.ReactNode {
  const pad = "  ".repeat(indent);
  if (value === null || typeof value !== "object") {
    if (typeof value === "boolean") return <span className={value ? "font-semibold text-success" : "text-muted-foreground"}>{String(value)}</span>;
    if (typeof value === "number") return <span className="text-primary">{value}</span>;
    return <span className="text-warning">&quot;{String(value)}&quot;</span>;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return <span className="text-muted-foreground">{"{}"}</span>;
  return (
    <>
      {"{"}
      {entries.map(([k, v], i) => (
        <span key={k}>
          {"\n" + pad + "  "}
          <span className="text-foreground/90">&quot;{k}&quot;</span>: <JsonView value={v} indent={indent + 1} />
          {i < entries.length - 1 ? "," : ""}
        </span>
      ))}
      {"\n" + pad + "}"}
    </>
  );
}
