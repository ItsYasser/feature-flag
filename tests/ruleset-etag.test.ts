import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getBackend, resetBackend } from "@/db";
import { GET } from "@/app/api/v1/rulesets/[env]/route";
import { setDefault } from "@/server/flags";
import { etagFor, ifNoneMatchMatches, rulesetResponse } from "@/server/ruleset-http";

describe("rulesetResponse (unit)", () => {
  const payload = { env: "prod", version: 44, flags: {} };

  it("returns 200 with ETag = version and no-store when there is no If-None-Match", async () => {
    const getVersion = vi.fn(async () => 44);
    const res = await rulesetResponse(null, { getVersion, getRuleset: async () => payload });
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe('"44"');
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(payload);
    expect(getVersion).not.toHaveBeenCalled(); // no conditional header → skip straight to the full read
  });

  it("returns 304 with an empty body and never loads the ruleset when the ETag matches", async () => {
    const getRuleset = vi.fn(async () => payload);
    const res = await rulesetResponse('"44"', { getVersion: async () => 44, getRuleset });
    expect(res.status).toBe(304);
    expect(await res.text()).toBe("");
    expect(res.headers.get("etag")).toBe('"44"');
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(getRuleset).not.toHaveBeenCalled(); // the cheap path is ONLY the version lookup
  });

  it("returns 200 with the new ruleset when the client's ETag is stale", async () => {
    const res = await rulesetResponse('"43"', { getVersion: async () => 44, getRuleset: async () => payload });
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe('"44"');
  });

  it("matches weak validators, lists and *", () => {
    const etag = etagFor(44);
    expect(ifNoneMatchMatches('W/"44"', etag)).toBe(true);
    expect(ifNoneMatchMatches('"12", "44"', etag)).toBe(true);
    expect(ifNoneMatchMatches("*", etag)).toBe(true);
    expect(ifNoneMatchMatches('"4"', etag)).toBe(false);
    expect(ifNoneMatchMatches(null, etag)).toBe(false);
  });
});

describe("GET /api/v1/rulesets/{env} (route handler against embedded Postgres)", () => {
  beforeAll(async () => {
    await resetBackend();
    await getBackend(); // migrates + seeds the in-memory database
  });
  afterAll(() => resetBackend());

  const call = (env: string, ifNoneMatch?: string) =>
    GET(
      new Request(`http://test/api/v1/rulesets/${env}`, {
        headers: ifNoneMatch ? { "if-none-match": ifNoneMatch } : {},
      }),
      { params: Promise.resolve({ env }) },
    );

  it("serves the seeded prod ruleset, then 304 for the same ETag", async () => {
    const first = await call("prod");
    expect(first.status).toBe(200);
    const body = await first.json();
    expect(body.flags["billing.new_invoice_design"]).toEqual({ default: false, overrides: { client_A: true } });
    expect(body.flags["frontend.dark_mode"]).toEqual({ default: true, overrides: { client_C: false } });
    expect(body.flags["billing.pdf_export_v2"]).toEqual({ default: false, overrides: {} });
    const etag = first.headers.get("etag")!;
    expect(etag).toBe(`"${body.version}"`);

    const second = await call("prod", etag);
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
  });

  it("a write bumps the version by exactly 1, so the old ETag gets a 200", async () => {
    const before = await (await call("prod")).json();
    await setDefault(await getBackend(), { user: "aisyah", team: "billing" }, "billing.pdf_export_v2", "prod", true, "Testing");

    const res = await call("prod", `"${before.version}"`);
    expect(res.status).toBe(200);
    const after = await res.json();
    expect(after.version).toBe(before.version + 1);
    expect(after.flags["billing.pdf_export_v2"].default).toBe(true);
  });

  it("rejects an unknown environment with a clear 400", async () => {
    const res = await call("qa");
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/environment must be one of dev, staging, prod/);
  });
});
