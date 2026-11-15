import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";

/** Small "Open" link from a Dashboard panel to its full page. */
export function OpenLink({ href, label = "Open" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-6 items-center gap-0.5 rounded-md px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {label}
      <ArrowUpRightIcon className="size-3.5" />
    </Link>
  );
}
