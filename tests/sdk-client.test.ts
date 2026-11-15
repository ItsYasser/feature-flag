import { afterEach, describe, expect, it, vi } from "vitest";
import { createFlagClient } from "@/lib/sdk";
import type { RulesetPayload } from "@/lib/sdk/types";

function ruleset(version: number, invoiceDefault: boolean): RulesetPayload {
  return {
    env: "prod",
    version,
    flags: { "billing.new_invoice_design": { default: invoiceDefault, overrides: { client_A: true } } },
  };
}

/** A tiny fake flag API: answers 304 when If-None-Match matches, otherwise 200 with ETag. */
function fakeApi(initial: RulesetPayload) {
  let current = initial;
  let down = false;
  const calls: { ifNoneMatch: string | null }[] = [];
  const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const ifNoneMatch = new Headers(init?.headers).get("if-none-match");
    calls.push({ ifNoneMatch });
    if (down) throw new TypeError("network down");
    const etag = `"${current.version}"`;
    if (ifNoneMatch === etag) return new Response(null, { status: 304, headers: { etag } });
    return new Response(JSON.stringify(current), { status: 200, headers: { etag } });
  });
  return {
    fetch: fetchImpl as unknown as typeof fetch,
    calls,
    publish: (r: RulesetPayload) => (current = r),
    setDown: (d: boolean) => (down = d),
  };
}

const quiet = { warn: vi.fn(), info: vi.fn() };

afterEach(() => vi.useRealTimers());

describe("SDK polling with ETag / If-None-Match", () => {
  it("first poll is unconditional; later polls send If-None-Match and 304s change nothing", async () => {
    const api = fakeApi(ruleset(5, false));
    const client = createFlagClient({ baseUrl: "http://flags", env: "prod", fetch: api.fetch, autoStart: false, logger: quiet });

    await client.refresh();
    expect(api.calls[0].ifNoneMatch).toBeNull();
    expect(client.getState().version).toBe(5);

    await client.refresh();
    expect(api.calls[1].ifNoneMatch).toBe('"5"');
    expect(client.getState().pollLog.map((e) => e.status)).toEqual([304, 200]);
    expect(client.getState().version).toBe(5);
    expect(client.isEnabled("billing.new_invoice_design", "client_B", true)).toBe(false);
  });

  it("on 200 swaps in the new ruleset", async () => {
    const api = fakeApi(ruleset(5, false));
    const client = createFlagClient({ baseUrl: "http://flags", env: "prod", fetch: api.fetch, autoStart: false, logger: quiet });
    await client.refresh();

    api.publish(ruleset(6, true));
    await client.refresh();
    expect(client.getState().version).toBe(6);
    expect(client.isEnabled("billing.new_invoice_design", "client_B", false)).toBe(true);
    expect(client.getState().pollLog[0]).toMatchObject({ status: 200, version: 6 });
  });

  it("on error keeps serving the last good copy and staleness grows", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T10:00:00Z"));
    const api = fakeApi(ruleset(5, true));
    const client = createFlagClient({ baseUrl: "http://flags", env: "prod", fetch: api.fetch, autoStart: false, logger: quiet });
    await client.refresh();

    api.setDown(true);
    vi.setSystemTime(new Date("2026-11-15T10:00:40Z"));
    await client.refresh();

    const s = client.getState();
    expect(s.pollLog[0].status).toBe("error");
    expect(s.version).toBe(5);
    expect(client.isEnabled("billing.new_invoice_design", "client_B", false)).toBe(true);
    expect(client.getStalenessSeconds()).toBe(40);
  });

  it("polls on the configured interval", async () => {
    vi.useFakeTimers();
    const api = fakeApi(ruleset(1, false));
    const client = createFlagClient({ baseUrl: "http://flags", env: "prod", fetch: api.fetch, pollIntervalMs: 5000, logger: quiet });
    await vi.advanceTimersByTimeAsync(0);
    expect(api.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.calls).toHaveLength(4);
    client.stop();
  });

  it("isEnabled never touches the network", async () => {
    const api = fakeApi(ruleset(5, false));
    const client = createFlagClient({ baseUrl: "http://flags", env: "prod", fetch: api.fetch, autoStart: false, logger: quiet });
    await client.refresh();
    const before = api.calls.length;
    for (let i = 0; i < 1000; i++) client.isEnabled("billing.new_invoice_design", "client_A", false);
    expect(api.calls.length).toBe(before);
  });

  it("unknown flag logs one warning and returns the fallback", async () => {
    const logger = { warn: vi.fn(), info: vi.fn() };
    const api = fakeApi(ruleset(5, false));
    const client = createFlagClient({ baseUrl: "http://flags", env: "prod", fetch: api.fetch, autoStart: false, logger });
    await client.refresh();
    expect(client.isEnabled("billing.typo_flag", "client_A", true)).toBe(true);
    expect(client.isEnabled("billing.typo_flag", "client_A", true)).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toContain("billing.typo_flag");
  });

  it("emergency override wins even during an outage with no ruleset", async () => {
    const api = fakeApi(ruleset(5, true));
    api.setDown(true);
    const client = createFlagClient({ baseUrl: "http://flags", env: "prod", fetch: api.fetch, autoStart: false, logger: quiet });
    await client.refresh();
    expect(client.evaluate("billing.new_invoice_design", "client_A", false)).toMatchObject({ value: false, source: "fallback" });
    client.setEmergencyOverride("billing.new_invoice_design", true);
    expect(client.evaluate("billing.new_invoice_design", "client_A", false)).toEqual({ value: true, source: "emergency_override" });
    client.setEmergencyOverride("billing.new_invoice_design", null);
    expect(client.isEnabled("billing.new_invoice_design", "client_A", false)).toBe(false);
  });
});
