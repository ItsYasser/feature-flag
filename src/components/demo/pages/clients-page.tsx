"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRightIcon, Building2Icon, MapPinIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CLIENTS } from "@/lib/domain";
import type { Evaluation } from "@/lib/sdk";
import { cn } from "@/lib/utils";
import type { FlagView } from "../api";
import { useDemo } from "../demo-context";
import { InvoiceCard, SOURCE_TAG } from "../invoice-card";
import { PageHeader } from "../page-header";
import { CODE_FLAGS } from "../service-panel";

const NO_CLIENT: Evaluation = { value: false, source: "fallback", fallbackReason: "no_ruleset" };

/** What the admin data says a client should get (the source of truth, not the service's copy). */
function configured(flag: FlagView, env: "dev" | "staging" | "prod", clientId: string) {
  const cfg = flag.environments[env];
  const o = cfg.overrides.find((x) => x.clientId === clientId);
  return o
    ? { value: o.enabled, source: "override" as const, reason: o.reason, by: o.updatedBy, at: o.updatedAt }
    : { value: cfg.default, source: "default" as const };
}

export function ClientsPage() {
  const d = useDemo();
  const router = useRouter();
  const active = d.flags?.filter((f) => f.status === "active") ?? [];
  const client = CLIENTS.find((c) => c.id === d.selectedClient) ?? CLIENTS[0];
  const sdk = d.service.client;
  const sdkVersion = d.service.state?.version ?? null;
  const latest = d.audit?.find((a) => a.environment === d.env)?.version ?? null;
  const behind = sdkVersion !== null && latest !== null && sdkVersion < latest;

  const manage = (flagKey: string) => {
    d.setSelectedFlag(flagKey);
    router.push("/flags");
  };

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-5 px-4 py-6">
      <PageHeader
        icon={Building2Icon}
        title="Clients"
        description="Which flags each client has."
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Matrix */}
        <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="flex items-center gap-1.5 border-b px-4 py-3">
            <h2 className="font-semibold tracking-tight">Client × flag</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Client</th>
                  {active.map((f) => (
                    <th key={f.key} className="px-3 py-2 font-medium">
                      <button onClick={() => manage(f.key)} className="font-mono text-[11px] hover:text-foreground" title={`Manage ${f.key}`}>
                        {f.key.split(".")[0]}.
                        <br />
                        <span className="text-foreground/80">{f.key.split(".")[1]}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CLIENTS.map((c) => {
                  const isSel = c.id === client.id;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => d.setSelectedClient(c.id)}
                      className={cn("cursor-pointer border-b transition-colors last:border-0", isSel ? "bg-accent/50" : "hover:bg-muted/40")}
                    >
                      <td className="relative px-4 py-3">
                        {isSel && <motion.span layoutId="client-row" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
                        <div className="font-medium">{c.name}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <code className="font-mono">{c.id}</code>· {c.plan} ·
                          <span className="flex items-center gap-0.5">
                            <MapPinIcon className="size-3" />
                            {c.city}
                          </span>
                        </div>
                      </td>
                      {active.map((f) => {
                        const v = configured(f, d.env, c.id);
                        return (
                          <td key={f.key} className="px-3 py-3" title={v.source === "override" ? `Override: ${v.reason || "no reason"} — ${v.by}` : "Follows the default"}>
                            <span className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "rounded-md px-1.5 py-px font-mono text-[11px] font-semibold",
                                  v.value ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                                )}
                              >
                                {v.value ? "ON" : "OFF"}
                              </span>
                              {v.source === "override" && (
                                <span className={cn("rounded px-1 text-[10px] font-semibold", SOURCE_TAG.client_override!.className)}>override</span>
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Detail */}
        <section className="overflow-hidden rounded-xl border bg-card shadow-xs xl:sticky xl:top-16">
          <div className="border-b px-4 py-3">
            <div className="text-xs text-muted-foreground">Selected client</div>
            <h2 className="text-lg font-semibold tracking-tight">{client.name}</h2>
            <div className="text-xs text-muted-foreground">
              <code className="font-mono">{client.id}</code> · {client.plan} plan · {client.city}
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                Live preview
              </div>
              <div className="h-52">
                <InvoiceCard
                  client={client}
                  highlighted={false}
                  flags={{
                    newInvoice: sdk?.evaluate(CODE_FLAGS[0].key, client.id, CODE_FLAGS[0].fallback) ?? NO_CLIENT,
                    darkMode: sdk?.evaluate(CODE_FLAGS[1].key, client.id, CODE_FLAGS[1].fallback) ?? NO_CLIENT,
                    pdfV2: sdk?.evaluate(CODE_FLAGS[2].key, client.id, CODE_FLAGS[2].fallback) ?? NO_CLIENT,
                  }}
                />
              </div>
              {behind && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
                  <RefreshCwIcon className="size-3 animate-spin" /> The service holds v{sdkVersion}; v{latest} is on its way.
                </p>
              )}
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">Flags</div>
              <ul className="divide-y rounded-lg border">
                {active.map((f) => {
                  const v = configured(f, d.env, client.id);
                  return (
                    <li key={f.key} className="flex items-start gap-3 px-3 py-2.5">
                      <span
                        className={cn(
                          "mt-0.5 rounded-md px-1.5 py-px font-mono text-[11px] font-semibold",
                          v.value ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {v.value ? "ON" : "OFF"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <code className="block truncate font-mono text-xs font-medium">{f.key}</code>
                        <div className="text-[11px] text-muted-foreground">
                          {v.source === "override" ? (
                            <>
                              Client override{v.reason ? <> · “{v.reason}”</> : null} · by {v.by}
                            </>
                          ) : (
                            <>Follows the {d.env} default</>
                          )}
                        </div>
                      </div>
                      <Button size="xs" variant="ghost" onClick={() => manage(f.key)}>
                        Manage <ArrowRightIcon />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
