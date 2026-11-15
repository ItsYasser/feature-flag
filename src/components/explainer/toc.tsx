"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const TOC_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "actors", label: "Who's involved" },
  { id: "architecture", label: "Architecture" },
  { id: "write-path", label: "Changing a flag" },
  { id: "read-path", label: "Getting updates" },
  { id: "evaluation", label: "Evaluating a flag" },
  { id: "data-model", label: "Data model" },
  { id: "failures", label: "When things fail" },
  { id: "trade-off", label: "Polling vs push" },
  { id: "permissions", label: "Who can change what" },
  { id: "delivery", label: "Delivery plan" },
  { id: "success", label: "Measuring success" },
] as const;

/** Sticky table of contents that follows the section you're reading. */
export function Toc() {
  const [active, setActive] = useState<string>(TOC_ITEMS[0].id);

  useEffect(() => {
    // The active section is the last one whose top has scrolled past the reading line.
    const onScroll = () => {
      const line = 80;
      let current: string = TOC_ITEMS[0].id;
      for (const t of TOC_ITEMS) {
        const el = document.getElementById(t.id);
        if (el && el.getBoundingClientRect().top <= line) current = t.id;
      }
      // At the very bottom, the last section wins even if it is short.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = TOC_ITEMS[TOC_ITEMS.length - 1].id;
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav aria-label="On this page" className="sticky top-6 hidden xl:block">
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">On this page</p>
      <ul className="space-y-0.5 border-l text-sm">
        {TOC_ITEMS.map((t) => (
          <li key={t.id} className="relative">
            {active === t.id && (
              <motion.span layoutId="toc-active" className="absolute inset-y-0 -left-px w-0.5 rounded-full bg-primary" />
            )}
            <a
              href={`#${t.id}`}
              className={cn(
                "block py-1 pl-3 transition-colors",
                active === t.id ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
