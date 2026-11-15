import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBackend, resetBackend, type Backend } from "@/db";
import { PUT as putDefault } from "@/app/api/v1/flags/[key]/env/[env]/default/route";
import { assertCanModify, canModify } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { getRulesetVersion, listAudit, setOverride } from "@/server/flags";

describe("team permission check (unit)", () => {
  const flag = { key: "billing.new_invoice_design", ownerTeam: "billing" };

  it("allows the owning team", () => {
    expect(canModify({ team: "billing" }, flag)).toBe(true);
    expect(() => assertCanModify({ user: "aisyah", team: "billing" }, flag)).not.toThrow();
  });

  it("rejects any other team with a 403 that names the owner", () => {
    expect(canModify({ team: "frontend" }, flag)).toBe(false);
    try {
      assertCanModify({ user: "budi", team: "frontend" }, flag);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(403);
      expect((err as ApiError).message).toMatch(/owned by team "billing"/);
    }
  });
});

describe("writes through the API (embedded Postgres)", () => {
  let backend: Backend;
  beforeAll(async () => {
    await resetBackend();
    backend = await getBackend();
  });
  afterAll(() => resetBackend());

  const put = (key: string, env: string, team: string, body: unknown) =>
    putDefault(
      new Request(`http://test/api/v1/flags/${key}/env/${env}/default`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-acting-user": "someone", "x-acting-team": team },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ key, env }) },
    );

  it("wrong team gets 403 and nothing is written (no version bump, no audit row)", async () => {
    const v0 = await getRulesetVersion(backend, "prod");
    const a0 = (await listAudit(backend, { limit: 200 })).length;

    const res = await put("billing.new_invoice_design", "prod", "frontend", { enabled: true, reason: "sneaky" });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden");

    expect(await getRulesetVersion(backend, "prod")).toBe(v0);
    expect((await listAudit(backend, { limit: 200 })).length).toBe(a0);
  });

  it("prod changes without a reason are rejected with 400", async () => {
    const res = await put("billing.new_invoice_design", "prod", "billing", { enabled: true });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/reason is required/i);
  });

  it("owning team succeeds: version +1 exactly, one audit row with before/after and reason", async () => {
    const v0 = await getRulesetVersion(backend, "prod");
    const res = await put("billing.new_invoice_design", "prod", "billing", { enabled: true, reason: "GA rollout" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.changed).toBe(true);
    expect(body.versions).toEqual({ prod: v0 + 1 });
    expect(await getRulesetVersion(backend, "prod")).toBe(v0 + 1);

    const [latest] = await listAudit(backend, { limit: 1 });
    expect(latest).toMatchObject({
      flagKey: "billing.new_invoice_design",
      environment: "prod",
      action: "default.set",
      before: { enabled: false },
      after: { enabled: true },
      reason: "GA rollout",
      version: v0 + 1,
    });
  });

  it("a write in one environment does not move another environment's version", async () => {
    const prod = await getRulesetVersion(backend, "prod");
    const dev = await getRulesetVersion(backend, "dev");
    await setOverride(backend, { user: "budi", team: "frontend" }, "frontend.dark_mode", "dev", "client_E", false, "");
    expect(await getRulesetVersion(backend, "dev")).toBe(dev + 1);
    expect(await getRulesetVersion(backend, "prod")).toBe(prod);
  });

  it("the database refuses to update or delete audit rows", async () => {
    await expect(backend.read.execute("UPDATE audit_log SET reason = 'rewritten'" as never)).rejects.toThrow();
    await expect(backend.read.execute("DELETE FROM audit_log" as never)).rejects.toThrow();
  });
});
