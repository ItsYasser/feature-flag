"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
  className,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-6 border-t py-12 first:border-t-0 first:pt-6", className)}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-balance">{title}</h2>
        {lead && <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">{lead}</p>}
      </motion.div>
      <motion.div
        className="mt-8"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </section>
  );
}

/** Reveal children one after another as they scroll into view. */
export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}
    >
      {children}
    </motion.div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "demo";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border-l-[3px] px-4 py-3 text-sm",
        tone === "info" && "border-primary bg-accent/60",
        tone === "warning" && "border-warning bg-warning/10",
        tone === "demo" && "border-muted-foreground/40 bg-muted/60",
      )}
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-0.5 text-muted-foreground">{children}</div>
    </div>
  );
}
