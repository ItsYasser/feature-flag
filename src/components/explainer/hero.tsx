"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DatabaseIcon, MonitorSmartphoneIcon, RefreshCwIcon, ToggleRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const LIFECYCLE = [
  { icon: ToggleRightIcon, title: "A team flips a switch", body: "For one client or for everyone." },
  { icon: DatabaseIcon, title: "Saved with an audit row", body: "In one transaction." },
  { icon: RefreshCwIcon, title: "Services catch up", body: "Within 15 seconds." },
  { icon: MonitorSmartphoneIcon, title: "The client sees it", body: "No release, no restart." },
];

const STATS = [
  { value: "< 50 µs", label: "per flag check" },
  { value: "≤ 15 s", label: "to reach every service" },
  { value: "0 bytes", label: "sent when nothing changed" },
  { value: "0", label: "requests blocked if the API is down" },
];

export function Hero() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % LIFECYCLE.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <p className="text-sm font-medium text-primary">Design &amp; scope</p>
      <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance">
        How the switchboard works
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-pretty text-muted-foreground">
        Turn features on or off per client in seconds, without a release. The design behind the{" "}
        <Link href="/" className="font-medium text-primary hover:underline">
          live demo
        </Link>
        .
      </p>

      {/* Lifecycle */}
      <div className="relative mt-10">
        <div className="absolute top-6 right-[12.5%] left-[12.5%] hidden h-0.5 bg-border md:block" />
        <motion.div
          className="absolute top-6 left-[12.5%] hidden h-0.5 bg-primary md:block"
          animate={{ width: `${(step / (LIFECYCLE.length - 1)) * 75}%` }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
        <ol className="relative grid gap-6 md:grid-cols-4">
          {LIFECYCLE.map((s, i) => {
            const Icon = s.icon;
            const on = i <= step;
            const current = i === step;
            return (
              <li key={s.title} className="flex flex-col items-center text-center">
                <motion.div
                  animate={{ scale: current ? 1.12 : 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className={cn(
                    "relative grid size-12 place-items-center rounded-full border-2 bg-background transition-colors duration-300",
                    on ? "border-primary text-primary" : "text-muted-foreground",
                  )}
                >
                  {current && (
                    <motion.span
                      key={step}
                      className="absolute inset-0 rounded-full border-2 border-primary"
                      initial={{ scale: 1, opacity: 0.8 }}
                      animate={{ scale: 1.7, opacity: 0 }}
                      transition={{ duration: 1.2 }}
                    />
                  )}
                  <Icon className="size-5" />
                </motion.div>
                <div className={cn("mt-3 text-sm font-semibold transition-colors", !on && "text-muted-foreground")}>
                  {i + 1}. {s.title}
                </div>
                <p className="mt-1 max-w-56 text-xs text-muted-foreground">{s.body}</p>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Stats */}
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <div className="font-mono text-2xl font-semibold tracking-tight tabular">{s.value}</div>
            <div className="mt-0.5 text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Scope */}
      <div className="mt-6 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <div className="font-semibold">In v1</div>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>• ON/OFF flags per environment</li>
            <li>• Per-client overrides</li>
            <li>• Kill switches for 10–30 services</li>
          </ul>
        </div>
        <div className="rounded-xl border border-dashed p-4">
          <div className="font-semibold">Not yet</div>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>• Percentage rollouts and A/B tests</li>
            <li>• Non-boolean flags</li>
            <li>• Instant push updates</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
