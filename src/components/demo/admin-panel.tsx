"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArchiveIcon, CalendarClockIcon, Loader2Icon, LockIcon, PlusIcon, ShieldAlertIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CLIENTS, type DemoUser, type Environment } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { AdminApiError, api, type FlagView, type WriteResult } from "./api";
import { ConfirmDialog, type ConfirmRequest } from "./confirm-dialog";
import { TeamBadge } from "./identity-picker";
import { Segmented } from "./segmented";
import { OpenLink } from "./open-link";

interface AdminPanelProps {
  actor: DemoUser;
  env: Environment;
  flags: FlagView[] | null;
  loadError: string | null;
  onWritten(result: WriteResult, label: string): void;
  onForbidden(): void;
  onHoverClient(clientId: string | null): void;
  onChanged(): void;
  selectedKey: string | null;
  onSelect(key: string): void;
  /** When set, the header shows an "Open" link to the full Flags page. */
  openHref?: string;
  title?: string;
  /** Hide the flag list (when the page shows its own list). */
  hideList?: boolean;
}

type ClientSetting = "default" | "on" | "off";

const ENV_NAME: Record<Environment, string> = { dev: "Development", staging: "Staging", prod: "Production" };
const onOff = (v: boolean) => (v ? "ON" : "OFF");

export function AdminPanel(props: AdminPanelProps) {
  const { actor, env, flags, loadError } = props;
  const { selectedKey, onSelect: setSelectedKey } = props;
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [creating, setCreating] = useState(false);
  const [forbidden, setForbidden] = useState<{ key: string; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const active = flags?.filter((f) => f.status === "active") ?? [];
  const archivedCount = (flags?.length ?? 0) - active.length;
  const selected = active.find((f) => f.key === selectedKey) ?? active[0] ?? null;
  const isProd = env === "prod";

  /** Perform a write. Returns true when done, or an error message for the dialog to show. */
  async function run(flag: FlagView, busyId: string, label: string, call: () => Promise<WriteResult>): Promise<true | string> {
    setBusy(busyId);
    try {
      const res = await call();
      setForbidden(null);
      props.onWritten(res, label);
      return true;
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 403) {
        setForbidden({ key: flag.key, message: err.message });
        props.onForbidden();
        toast.error("403 Forbidden: the server rejected this change", { description: err.message });
        return true;
      }
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof AdminApiError && err.status === 400) return message;
      toast.error("Change failed", { description: message });
      return true;
    } finally {
      setBusy(null);
    }
  }

  /** Prod writes go through a confirmation with a required reason; dev/staging apply instantly. */
  function write(opts: {
    flag: FlagView;
    busyId: string;
    title: string;
    summary: React.ReactNode;
    label: string;
    confirmLabel?: string;
    destructive?: boolean;
    alwaysConfirm?: boolean;
    call(reason: string): Promise<WriteResult>;
  }) {
    if (!isProd && !opts.alwaysConfirm) {
      void run(opts.flag, opts.busyId, opts.label, () => opts.call("")).then((r) => {
        if (r !== true) toast.error("Change rejected", { description: r });
      });
      return;
    }
    setConfirm({
      title: opts.title,
      summary: opts.summary,
      production: isProd || !!opts.alwaysConfirm,
      requireReason: true,
      confirmLabel: opts.confirmLabel ?? "Apply to production",
      destructive: opts.destructive,
      onConfirm: (reason) => run(opts.flag, opts.busyId, opts.label, () => opts.call(reason)),
    });
  }

  function setDefault(flag: FlagView, enabled: boolean) {
    write({
      flag,
      busyId: `${flag.key}:default`,
      title: `Change the ${ENV_NAME[env].toLowerCase()} default?`,
      summary: <ChangeSummary flagKey={flag.key} target={`Every client set to “Default”`} from={!enabled} to={enabled} />,
      label: `${flag.key} default → ${onOff(enabled)}`,
      call: (reason) => api.setDefault(actor, flag.key, env, enabled, reason),
    });
  }

  function setClient(flag: FlagView, clientId: string, next: ClientSetting) {
    const cfg = flag.environments[env];
    const current = cfg.overrides.find((o) => o.clientId === clientId);
    const from = current ? current.enabled : cfg.default;
    const name = CLIENTS.find((c) => c.id === clientId)?.name ?? clientId;
    if (next === "default") {
      write({
        flag,
        busyId: `${flag.key}:${clientId}`,
        title: "Remove this client's override?",
        summary: <ChangeSummary flagKey={flag.key} target={`${name} goes back to the default`} from={from} to={cfg.default} />,
        label: `${name} back to default (${onOff(cfg.default)})`,
        confirmLabel: isProd ? "Apply to production" : "Remove override",
        call: (reason) => api.deleteOverride(actor, flag.key, env, clientId, reason),
      });
      return;
    }
    const enabled = next === "on";
    write({
      flag,
      busyId: `${flag.key}:${clientId}`,
      title: current ? "Change this client's override?" : "Add a client override?",
      summary: <ChangeSummary flagKey={flag.key} target={`Only ${name} (${clientId})`} from={from} to={enabled} />,
      label: `${name} → ${onOff(enabled)}`,
      call: (reason) => api.setOverride(actor, flag.key, env, clientId, enabled, reason),
    });
  }

  function archive(flag: FlagView) {
    write({
      flag,
      busyId: `${flag.key}:archive`,
      title: `Archive ${flag.key}?`,
      summary:
        "The flag is removed from every environment's ruleset. Code that still checks it gets its in-code fallback and logs a warning.",
      label: `${flag.key} archived`,
      confirmLabel: "Archive flag",
      destructive: true,
      alwaysConfirm: true,
      call: (reason) => api.archive(actor, flag.key, reason),
    });
  }

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
      {/* Flag list */}
      <div className={cn("flex items-center gap-2 px-4 pt-3.5 pb-2", props.hideList && "border-b pb-3")}>
        <h2 className="font-semibold tracking-tight">{props.title ?? "Flags"}</h2>
        <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular">{active.length}</span>
        <span className="text-xs text-muted-foreground">in {ENV_NAME[env].toLowerCase()}</span>
        <Button size="xs" variant="outline" className="ml-auto" onClick={() => setCreating(true)}>
          <PlusIcon /> New flag
        </Button>
        {props.openHref && <OpenLink href={props.openHref} />}
      </div>

      <div className={cn("space-y-1 px-2 pb-2", props.hideList && "hidden")}>
        {loadError && (
          <div className="mx-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Couldn&apos;t load flags: {loadError}
          </div>
        )}
        {!flags && !loadError && [0, 1, 2].map((i) => <div key={i} className="mx-2 h-12 animate-pulse rounded-lg bg-muted/60" />)}
        {active.map((f) => {
          const cfg = f.environments[env];
          const isSel = f.key === selected?.key;
          const owned = f.ownerTeam === actor.team;
          return (
            <button
              key={f.key}
              onClick={() => setSelectedKey(f.key)}
              className={cn(
                "relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                isSel ? "bg-accent" : "hover:bg-muted/60",
              )}
            >
              {isSel && <motion.span layoutId="flag-sel" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <code className={cn("truncate font-mono text-[13px]", isSel && "font-semibold")}>{f.key}</code>
                  {!owned && <LockIcon className="size-3 shrink-0 text-muted-foreground" aria-label="Owned by another team" />}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <TeamBadge team={f.ownerTeam} />
                  {cfg.overrides.length > 0 && `${cfg.overrides.length} override${cfg.overrides.length > 1 ? "s" : ""}`}
                </div>
              </div>
              <ValuePill value={cfg.default} />
            </button>
          );
        })}
        {archivedCount > 0 && (
          <p className="px-3 pt-1 text-[11px] text-muted-foreground">
            {archivedCount} archived flag{archivedCount > 1 ? "s" : ""} hidden
          </p>
        )}
      </div>

      {/* Selected flag detail */}
      <div className={cn("min-h-0 flex-1 overflow-y-auto bg-muted/20", !props.hideList && "border-t")}>
        <AnimatePresence mode="wait" initial={false}>
          {selected && (
            <motion.div
              key={selected.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-3 p-4"
            >
              <FlagDetail
                flag={selected}
                env={env}
                actor={actor}
                busy={busy}
                forbidden={forbidden?.key === selected.key ? forbidden.message : null}
                onDismissForbidden={() => setForbidden(null)}
                onDefault={(v) => setDefault(selected, v)}
                onClient={(id, s) => setClient(selected, id, s)}
                onArchive={() => archive(selected)}
                onHoverClient={props.onHoverClient}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      <CreateFlagDialog
        open={creating}
        actor={actor}
        onClose={() => setCreating(false)}
        onSubmit={async (key, description) => {
          try {
            await api.createFlag(actor, { key, description });
            toast.success(`${key} created`, { description: "It starts OFF in every environment." });
            setSelectedKey(key);
            props.onChanged();
            return true;
          } catch (err) {
            return err instanceof Error ? err.message : String(err);
          }
        }}
      />
    </section>
  );
}

// -------------------------------------------------------------------------------------------

function FlagDetail(props: {
  flag: FlagView;
  env: Environment;
  actor: DemoUser;
  busy: string | null;
  forbidden: string | null;
  onDismissForbidden(): void;
  onDefault(enabled: boolean): void;
  onClient(clientId: string, setting: ClientSetting): void;
  onArchive(): void;
  onHoverClient(id: string | null): void;
}) {
  const { flag, env, actor, busy, forbidden } = props;
  const cfg = flag.environments[env];
  const owned = flag.ownerTeam === actor.team;

  return (
    <>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <code className="font-mono text-sm font-semibold break-all">{flag.key}</code>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{flag.description}</p>
          {flag.expiresAt && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarClockIcon className="size-3" />
              Planned removal {new Date(flag.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
        <Button size="icon-sm" variant="ghost" aria-label={`Archive ${flag.key}`} title="Archive flag" onClick={props.onArchive}>
          <ArchiveIcon />
        </Button>
      </div>

      {!owned && !forbidden && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <LockIcon className="size-3.5 shrink-0" />
          <span>
            Owned by <b className="text-foreground">{flag.ownerTeam}</b>. Your changes will be rejected.
          </span>
        </div>
      )}

      <AnimatePresence>
        {forbidden && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", x: [0, -6, 6, -4, 4, 0] }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
              <ShieldAlertIcon className="mt-px size-4 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">403 Forbidden: nothing was changed</div>
                <div className="mt-0.5 opacity-90">{forbidden}</div>
              </div>
              <button aria-label="Dismiss" onClick={props.onDismissForbidden} className="opacity-70 hover:opacity-100">
                <XIcon className="size-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Default */}
      <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
        <div className="min-w-0 flex-1 text-sm font-medium">Default for everyone</div>
        {busy === `${flag.key}:default` && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
        <Segmented
          id={`default-${flag.key}`}
          ariaLabel="Default value"
          value={cfg.default ? "on" : "off"}
          onChange={(v) => props.onDefault(v === "on")}
          options={[
            { value: "off", label: "OFF", tone: "off" },
            { value: "on", label: "ON", tone: "on" },
          ]}
        />
      </div>

      {/* Clients */}
      <div>
        <div className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">Per client</div>
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {CLIENTS.map((c) => {
            const o = cfg.overrides.find((x) => x.clientId === c.id);
            const setting: ClientSetting = o ? (o.enabled ? "on" : "off") : "default";
            const isBusy = busy === `${flag.key}:${c.id}`;
            return (
              <li
                key={c.id}
                onMouseEnter={() => props.onHoverClient(c.id)}
                onMouseLeave={() => props.onHoverClient(null)}
                className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  {o?.reason && (
                    <div className="truncate text-[11px] text-muted-foreground" title={o.reason}>
                      “{o.reason}”
                    </div>
                  )}
                </div>
                {isBusy && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
                <Segmented
                  id={`client-${flag.key}-${c.id}`}
                  size="sm"
                  ariaLabel={`Setting for ${c.name}`}
                  value={setting}
                  onChange={(v) => props.onClient(c.id, v)}
                  options={[
                    { value: "default", label: `Default · ${onOff(cfg.default)}`, tone: "neutral" },
                    { value: "on", label: "ON", tone: "on" },
                    { value: "off", label: "OFF", tone: "off" },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

function ValuePill({ value, small, muted }: { value: boolean; small?: boolean; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-mono font-semibold",
        small ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]",
        value ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
        muted && "opacity-60",
      )}
    >
      {onOff(value)}
    </span>
  );
}

function ChangeSummary({ flagKey, target, from, to }: { flagKey: string; target: string; from: boolean; to: boolean }) {
  return (
    <div className="mt-1 space-y-2">
      <div>
        <code className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">{flagKey}</code>
        <div className="mt-1">{target}</div>
      </div>
      <div className="flex items-center gap-2 font-mono text-xs">
        <ValuePill value={from} />
        <span className="text-muted-foreground">→</span>
        <ValuePill value={to} />
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------------------------

function CreateFlagDialog({
  open,
  actor,
  onClose,
  onSubmit,
}: {
  open: boolean;
  actor: DemoUser;
  onClose(): void;
  onSubmit(key: string, description: string): Promise<true | string>;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open && <CreateFlagBody key={actor.team} actor={actor} onClose={onClose} onSubmit={onSubmit} />}
    </Dialog>
  );
}

function CreateFlagBody({
  actor,
  onClose,
  onSubmit,
}: {
  actor: DemoUser;
  onClose(): void;
  onSubmit(key: string, description: string): Promise<true | string>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = `${actor.team}.${name.trim()}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await onSubmit(key, description.trim());
    setBusy(false);
    if (res === true) onClose();
    else setError(res);
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          <DialogTitle>New flag</DialogTitle>
          <DialogDescription>
            Owned by your team (<b className="text-foreground">{actor.team}</b>). It starts OFF everywhere, and the key
            can&apos;t be renamed later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="flag-key">Key</Label>
          <div className="flex items-center rounded-lg border focus-within:ring-3 focus-within:ring-ring/50">
            <span className="pl-2.5 font-mono text-sm text-muted-foreground">{actor.team}.</span>
            <Input
              id="flag-key"
              autoFocus
              className="border-0 pl-0.5 font-mono shadow-none focus-visible:ring-0"
              value={name}
              onChange={(e) => {
                setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
                setError(null);
              }}
              placeholder="my_new_feature"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">Lowercase letters, digits and underscores.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="flag-desc">What does turning it on change?</Label>
          <Textarea id="flag-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create flag"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
