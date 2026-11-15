"use client";

import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** The small "Why it works this way" hint attached to each control. */
export function Why({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="Why it works this way"
            className="inline-grid size-5 place-items-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground"
          />
        }
      >
        <InfoIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72 flex-col items-start gap-0.5 py-2 leading-snug">
        <span className="text-[10px] font-semibold tracking-wide uppercase opacity-60">Why it works this way</span>
        <span>{children}</span>
      </TooltipContent>
    </Tooltip>
  );
}
