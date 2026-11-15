"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CreditCardIcon, FileTextIcon, MoonIcon, SparklesIcon, SunIcon, ZapIcon } from "lucide-react";
import type { DemoClient } from "@/lib/domain";
import type { Evaluation } from "@/lib/sdk";
import { cn } from "@/lib/utils";

export interface CardFlags {
  newInvoice: Evaluation;
  darkMode: Evaluation;
  pdfV2: Evaluation;
}

const INVOICES: Record<string, { number: string; due: string; total: number }> = {
  client_A: { number: "INV-2026-0412", due: "28 Nov", total: 13_986_000 },
  client_B: { number: "INV-2026-0413", due: "30 Nov", total: 8_069_700 },
  client_C: { number: "INV-2026-0414", due: "2 Dec", total: 4_395_600 },
  client_D: { number: "INV-2026-0415", due: "5 Dec", total: 10_045_500 },
  client_E: { number: "INV-2026-0416", due: "6 Dec", total: 2_109_000 },
};

const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

export const SOURCE_TAG: Record<Evaluation["source"], { label: string; className: string } | null> = {
  env_default: null,
  client_override: { label: "override", className: "bg-primary/15 text-primary" },
  fallback: { label: "fallback", className: "bg-warning/20 text-warning" },
  emergency_override: { label: "emergency", className: "bg-destructive/15 text-destructive" },
};

export function InvoiceCard({
  client,
  flags,
  highlighted,
}: {
  client: DemoClient;
  flags: CardFlags;
  highlighted: boolean;
}) {
  const inv = INVOICES[client.id];
  const isNew = flags.newInvoice.value;
  const isDark = flags.darkMode.value;
  const signature = `${isNew}-${isDark}-${flags.pdfV2.value}`;

  return (
    <div
      // `.dark` / `.light` re-declare the colour tokens for this card only, so its theme is independent of the page.
      className={cn(
        isDark ? "dark" : "light",
        "relative flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs transition-[background-color,box-shadow] duration-500",
        highlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      {/* Flash + badge whenever a flag changes what this card renders */}
      <AnimatePresence initial={false}>
        <motion.div
          key={signature}
          className="pointer-events-none absolute inset-0 z-10 rounded-xl ring-2 ring-primary ring-inset"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.2, ease: "easeIn" }}
        />
      </AnimatePresence>
      <AnimatePresence initial={false}>
        <motion.span
          key={signature}
          className="absolute top-2 right-9 z-10 rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-primary-foreground"
          initial={{ opacity: 1, y: -4 }}
          animate={{ opacity: [1, 1, 0], y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.6, times: [0, 0.7, 1] }}
        >
          Updated
        </motion.span>
      </AnimatePresence>

      {/* Dashboard chrome */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <div className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
          {client.id.slice(-1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold">{client.name}</div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">{client.id}</div>
        </div>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={isDark ? "moon" : "sun"}
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            className="text-muted-foreground"
          >
            {isDark ? <MoonIcon className="size-3.5" /> : <SunIcon className="size-3.5" />}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Invoice preview — swaps design */}
      <div className="relative min-h-0 flex-1 px-3">
        <AnimatePresence mode="wait" initial={false}>
          {isNew ? (
            <motion.div
              key="new"
              initial={{ opacity: 0, rotateX: -60, y: 10 }}
              animate={{ opacity: 1, rotateX: 0, y: 0 }}
              exit={{ opacity: 0, rotateX: 60, y: -10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              style={{ transformPerspective: 600 }}
              className="overflow-hidden rounded-lg border border-primary/25"
            >
              <div className="bg-gradient-to-br from-primary to-primary/70 px-2.5 py-2 text-primary-foreground">
                <div className="flex items-center justify-between text-[9px] font-semibold tracking-wider uppercase opacity-85">
                  <span>Invoice</span>
                  <span className="flex items-center gap-0.5 normal-case">
                    <SparklesIcon className="size-2.5" /> new design
                  </span>
                </div>
                <div className="text-base leading-tight font-semibold tabular">{rupiah(inv.total)}</div>
                <div className="text-[10px] opacity-85">Due {inv.due} · PPN 11% included</div>
              </div>
              <div className="flex gap-1.5 p-2">
                <span className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary py-1 text-[10px] font-medium text-primary-foreground">
                  <CreditCardIcon className="size-3" /> Pay now
                </span>
                <PdfButton v2={flags.pdfV2.value} />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="old"
              initial={{ opacity: 0, rotateX: -60, y: 10 }}
              animate={{ opacity: 1, rotateX: 0, y: 0 }}
              exit={{ opacity: 0, rotateX: 60, y: -10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              style={{ transformPerspective: 600 }}
              className="rounded-md border border-dashed px-2.5 py-2 font-mono text-[10px]"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold tracking-wider">INVOICE</span>
                <span className="text-muted-foreground">{inv.number}</span>
              </div>
              <div className="my-1.5 border-t border-dashed" />
              <div className="flex justify-between font-semibold">
                <span>TOTAL</span>
                <span className="tabular">{rupiah(inv.total)}</span>
              </div>
              <div className="text-muted-foreground">Due {inv.due}</div>
              <div className="mt-1.5 flex">
                <PdfButton v2={flags.pdfV2.value} wide />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* What each flag resolved to, and where it came from */}
      <div className="mt-2 flex flex-wrap gap-1 border-t px-2.5 py-1.5">
        <FlagChip icon={<FileTextIcon />} label={isNew ? "New invoice" : "Classic invoice"} ev={flags.newInvoice} flag="billing.new_invoice_design" />
        <FlagChip icon={isDark ? <MoonIcon /> : <SunIcon />} label={isDark ? "Dark" : "Light"} ev={flags.darkMode} flag="frontend.dark_mode" />
        <FlagChip icon={<ZapIcon />} label={flags.pdfV2.value ? "PDF v2" : "PDF v1"} ev={flags.pdfV2} flag="billing.pdf_export_v2" />
      </div>
    </div>
  );
}

function PdfButton({ v2, wide }: { v2: boolean; wide?: boolean }) {
  return (
    <span className={cn("flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium", wide && "flex-1")}>
      {v2 ? <ZapIcon className="size-3 text-primary" /> : <FileTextIcon className="size-3" />}
      {v2 ? "PDF v2" : "PDF"}
    </span>
  );
}

function FlagChip({ icon, label, ev, flag }: { icon: React.ReactNode; label: string; ev: Evaluation; flag: string }) {
  const tag = SOURCE_TAG[ev.source];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-muted/70 py-px pr-0.5 pl-1.5 text-[10px] text-muted-foreground [&_svg]:size-3"
      title={`${flag} = ${ev.value ? "ON" : "OFF"} (${tag?.label ?? "environment default"})`}
    >
      {icon}
      <span className="text-foreground/80">{label}</span>
      {tag ? <span className={cn("rounded px-1 font-semibold", tag.className)}>{tag.label}</span> : <span className="pr-1" />}
    </span>
  );
}
