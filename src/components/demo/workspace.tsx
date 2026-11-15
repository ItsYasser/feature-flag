"use client";

import { AdminPanel } from "./admin-panel";
import { useDemo } from "./demo-context";
import { ServicePanel } from "./service-panel";
import { UnderTheHood } from "./under-the-hood";

/** Height left under the context bar (3rem + border). */
export const UNDER_HEADER = "lg:h-[calc(100dvh-3rem-1px)]";

/** Dashboard: everything on one screen. Each panel links to its own page. */
export function DemoWorkspace() {
  const d = useDemo();

  return (
    <div
      className={`mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-3 px-4 py-3 ${UNDER_HEADER} lg:min-h-[600px] lg:flex-none lg:overflow-hidden`}
    >
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(380px,0.85fr)_minmax(0,2fr)] lg:grid-rows-[minmax(0,1fr)]">
        <AdminPanel
          actor={d.actor}
          env={d.env}
          flags={d.flags}
          loadError={d.flagsError}
          onWritten={d.onWritten}
          onForbidden={() => d.mark("forbidden")}
          onHoverClient={d.setHoveredClient}
          onChanged={d.reloadFlags}
          selectedKey={d.selectedFlag}
          onSelect={d.setSelectedFlag}
          openHref="/flags"
        />
        <div className="flex min-h-0 flex-col gap-3">
          <ServicePanel
            service={d.service}
            env={d.env}
            now={d.now}
            hoveredClient={d.hoveredClient}
            onOutageChange={(on) => on && d.mark("outage")}
            openHref="/services"
          />
          <UnderTheHood service={d.service} now={d.now} audit={d.audit?.slice(0, 30) ?? null} auditHref="/audit" />
        </div>
      </div>
    </div>
  );
}
