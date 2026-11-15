"use client";

import { motion } from "framer-motion";
import { CheckIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type GuideStep = "flip" | "polls" | "forbidden" | "outage" | "restart" | "emergency";

const STEPS: { id: GuideStep; label: string; hint: string }[] = [
  { id: "flip", label: "Flip a flag", hint: "Change a client's setting on the left and watch its card update within one poll." },
  { id: "polls", label: "See 304s", hint: "Under the hood, polls that find nothing new come back as an empty 304 (gray)." },
  { id: "forbidden", label: "Wrong team", hint: "Act as someone from frontend and try to change a billing flag: the server returns 403." },
  { id: "outage", label: "Outage", hint: "Turn on “Flag API outage”: the cards keep working while staleness climbs." },
  { id: "restart", label: "Restart", hint: "Restart the service while the outage is on: every card falls back to its in-code default." },
  { id: "emergency", label: "Override", hint: "Force a flag with the emergency override. It wins over everything, even with the API down." },
];

/** A checklist for the 3-minute walkthrough that ticks itself off as you go. */
export function DemoGuide({ done, className }: { done: ReadonlySet<GuideStep>; className?: string }) {
  const next = STEPS.find((s) => !done.has(s.id))?.id;
  return (
    <ol className={cn("flex flex-wrap items-center gap-1", className)} aria-label="Demo walkthrough">
      <li className="mr-1 text-xs font-medium text-muted-foreground">Try it</li>
      {STEPS.map((s, i) => {
        const isDone = done.has(s.id);
        const isNext = s.id === next;
        return (
          <li key={s.id}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className={cn(
                      "flex cursor-default items-center gap-1.5 rounded-full border p-0.5 text-xs transition-colors min-[1760px]:pr-2.5",
                      isNext && "pr-2.5",
                      isDone && "border-success/30 bg-success/10 text-foreground",
                      isNext && "border-primary/50 bg-accent text-accent-foreground",
                      !isDone && !isNext && "text-muted-foreground",
                    )}
                  />
                }
              >
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full text-[10px] font-semibold",
                    isDone ? "bg-success text-white" : isNext ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {isDone ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <CheckIcon className="size-3" strokeWidth={3} />
                    </motion.span>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={cn(!isNext && "hidden min-[1760px]:inline")}>{s.label}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-64">
                {s.hint}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ol>
  );
}
