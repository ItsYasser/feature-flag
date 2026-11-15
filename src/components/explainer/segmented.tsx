"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Colour of the active pill. */
  tone?: "neutral" | "on" | "off" | "danger" | "accent";
  title?: string;
}

type Tone = NonNullable<SegmentOption<string>["tone"]>;
const TONE_BG: Record<Tone, string> = {
  neutral: "bg-background shadow-xs ring-1 ring-border",
  accent: "bg-primary shadow-xs",
  on: "bg-success shadow-xs",
  off: "bg-foreground/85 shadow-xs",
  danger: "bg-destructive shadow-xs",
};
const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-foreground",
  accent: "text-primary-foreground",
  on: "text-white",
  off: "text-background",
  danger: "text-white",
};

/** A compact segmented control with an animated active pill. `id` must be unique on the page. */
export function Segmented<T extends string>({
  id,
  value,
  options,
  onChange,
  size = "md",
  ariaLabel,
  className,
}: {
  id: string;
  value: T;
  options: SegmentOption<NoInfer<T>>[];
  onChange(value: NoInfer<T>): void;
  size?: "sm" | "md";
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex shrink-0 items-center rounded-lg bg-muted p-0.5", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => !active && onChange(o.value)}
            className={cn(
              "relative rounded-md font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
              active ? cn("cursor-default", TONE_TEXT[o.tone ?? "neutral"]) : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className={cn("absolute inset-0 rounded-md", TONE_BG[o.tone ?? "neutral"])}
                transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
              />
            )}
            <span className="relative flex items-center gap-1">
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
