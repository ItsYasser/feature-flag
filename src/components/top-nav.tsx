"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import {
  BookOpenIcon,
  Building2Icon,
  FileDownIcon,
  FlagIcon,
  LayoutDashboardIcon,
  MoonIcon,
  ScrollTextIcon,
  ServerIcon,
  SparklesIcon,
  SunIcon,
  ToggleRightIcon,
} from "lucide-react";
import { useDemo } from "@/components/demo/demo-context";
import { DemoGuide } from "@/components/demo/demo-guide";
import { IdentityPicker } from "@/components/demo/identity-picker";
import { Segmented } from "@/components/demo/segmented";
import { ENVIRONMENTS } from "@/lib/domain";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/flags", label: "Flags", icon: ToggleRightIcon },
  { href: "/clients", label: "Clients", icon: Building2Icon },
  { href: "/services", label: "Services", icon: ServerIcon },
  { href: "/audit", label: "Audit log", icon: ScrollTextIcon },
] as const;
const GUIDE_LINK = { href: "/how-it-works", label: "How it works", icon: BookOpenIcon } as const;
/** The design doc as a file. Drop the PDF at public/design/Assessment-Yasser-Harzelli.pdf. */
const DESIGN_PDF = { href: "/design/Assessment-Yasser-Harzelli.pdf", filename: "Assessment-Yasser-Harzelli.pdf" } as const;

const subscribeNoop = () => () => {};
const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

/** Page frame: section navigation as a vertical sidebar on the left, content on the right. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showContext = !pathname.startsWith("/how-it-works");
  return (
    <div className="flex min-h-dvh">
      <Sidebar pathname={pathname} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav pathname={pathname} />
        {showContext && <ContextBar />}
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";

  return (
    <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col border-r bg-card/60 lg:flex">
      <Link href="/" className="flex h-12 items-center gap-2 border-b px-4 font-semibold tracking-tight">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
          <FlagIcon className="size-4" />
        </span>
        SistemSaya <span className="font-normal text-muted-foreground">Flags</span>
      </Link>

      <nav aria-label="Sections" className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV_LINKS.map((l) => (
          <NavItem key={l.href} link={l} active={isActive(pathname, l.href)} />
        ))}
        <div className="my-2 border-t" />
        <GuideButton active={isActive(pathname, GUIDE_LINK.href)} />
        <PdfLink />
      </nav>

      <button
        type="button"
        onClick={() => setTheme(dark ? "light" : "dark")}
        className="m-2 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {dark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
        {dark ? "Light mode" : "Dark mode"}
      </button>
    </aside>
  );
}

function NavItem({
  link,
  active,
}: {
  link: { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
  active: boolean;
}) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      className={cn(
        "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {active && <motion.span layoutId="side-nav" className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />}
      <Icon className="size-4" />
      {link.label}
    </Link>
  );
}

/** "How it works" stands out: accent gradient with a light sweep running across it. */
function GuideButton({ active }: { active: boolean }) {
  return (
    <Link
      href={GUIDE_LINK.href}
      className={cn(
        "group relative flex items-center gap-2.5 overflow-hidden rounded-lg bg-gradient-to-r from-primary to-primary/75 px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/30 transition-transform hover:-translate-y-px",
        active && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
      )}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
        animate={{ x: ["0%", "400%"] }}
        transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
      />
      <SparklesIcon className="size-4" />
      How it works
      <span className="ml-auto rounded bg-white/20 px-1.5 text-[10px] font-semibold uppercase">Guide</span>
    </Link>
  );
}

/** Child of "How it works": downloads the design doc as a PDF. */
function PdfLink() {
  return (
    <div className="relative ml-5 border-l pl-3">
      <span aria-hidden className="absolute top-1/2 left-0 h-px w-2.5 bg-border" />
      <a
        href={DESIGN_PDF.href}
        download={DESIGN_PDF.filename}
        className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <FileDownIcon className="size-4" />
        Download PDF
      </a>
    </div>
  );
}

/** Small screens: the sidebar collapses into a scrollable row at the top. */
function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Sections" className="flex gap-1 overflow-x-auto border-b px-3 py-2 lg:hidden">
      {[...NAV_LINKS, GUIDE_LINK].map((l) => {
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm",
              isActive(pathname, l.href) ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {l.label}
          </Link>
        );
      })}
      <a
        href={DESIGN_PDF.href}
        download={DESIGN_PDF.filename}
        className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground"
      >
        <FileDownIcon className="size-4" />
        PDF
      </a>
    </nav>
  );
}

function ContextBar() {
  const { env, setEnv, actor, setActor, done } = useDemo();
  return (
    <div className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex min-h-12 max-w-[1680px] flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-1.5">
        <Segmented
          id="env"
          ariaLabel="Environment"
          value={env}
          onChange={setEnv}
          options={ENVIRONMENTS.map((e) => ({
            value: e,
            tone: e === "prod" ? "danger" : "accent",
            label: e === "prod" ? "Production" : e === "staging" ? "Staging" : "Development",
          }))}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Acting as</span>
          <IdentityPicker actor={actor} onChange={setActor} />
        </div>
        <DemoGuide done={done} className="ml-auto" />
      </div>
    </div>
  );
}
