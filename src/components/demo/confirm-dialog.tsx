"use client";

import { useState } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const QUICK_REASONS = [
  "Customer requested it",
  "Planned rollout step",
  "Incident mitigation",
  "QA sign-off received",
];

export interface ConfirmRequest {
  title: string;
  summary: React.ReactNode;
  production: boolean;
  requireReason: boolean;
  confirmLabel: string;
  destructive?: boolean;
  /** Return true to close; return a string to show it as an error and keep the dialog open. */
  onConfirm(reason: string): Promise<true | string>;
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose(): void }) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      {request && <ConfirmBody key={request.title + String(request.summary)} request={request} onClose={onClose} />}
    </Dialog>
  );
}

function ConfirmBody({ request, onClose }: { request: ConfirmRequest; onClose(): void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tooShort = request.requireReason && reason.trim().length < 3;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tooShort) {
      setError("Production changes need a reason (at least 3 characters) — it goes into the audit log.");
      return;
    }
    setBusy(true);
    const result = await request.onConfirm(reason.trim());
    setBusy(false);
    if (result === true) onClose();
    else setError(result);
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          {request.production && (
            <span className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
              <TriangleAlertIcon className="size-3" /> Production change
            </span>
          )}
          <DialogTitle>{request.title}</DialogTitle>
          <DialogDescription render={<div />}>{request.summary}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="confirm-reason">
            Reason {request.requireReason ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(optional)</span>}
          </Label>
          <Textarea
            id="confirm-reason"
            autoFocus
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              // Enter submits (Shift+Enter for a new line) — keeps the demo flow fast.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Why are you making this change?"
            rows={2}
          />
          <div className="flex flex-wrap gap-1">
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setReason(r);
                  setError(null);
                  // Hand focus back to the reason box so Enter submits straight away.
                  document.getElementById("confirm-reason")?.focus();
                }}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] transition-colors hover:border-primary/50 hover:text-foreground",
                  reason === r ? "border-primary/60 bg-accent text-accent-foreground" : "text-muted-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Recorded in the append-only audit log with your name.</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={request.destructive ? "destructive" : "default"} disabled={busy}>
            {busy ? "Saving…" : request.confirmLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
