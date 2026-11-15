import { describe, expect, it } from "vitest";
import { compileRuleset, evaluateFlag } from "@/lib/sdk/evaluate";

const { ruleset } = compileRuleset({
  env: "prod",
  version: 7,
  flags: {
    "billing.new_invoice_design": { default: false, overrides: { client_A: true } },
    "frontend.dark_mode": { default: true, overrides: { client_C: false } },
  },
});
const none = new Map<string, boolean>();

describe("evaluation priority: emergency → client override → env default → fallback", () => {
  it("uses the environment default when the client has no override", () => {
    expect(evaluateFlag(ruleset, none, "billing.new_invoice_design", "client_B", true)).toEqual({
      value: false,
      source: "env_default",
    });
  });

  it("a client override beats the environment default (both directions)", () => {
    expect(evaluateFlag(ruleset, none, "billing.new_invoice_design", "client_A", false)).toEqual({
      value: true,
      source: "client_override",
    });
    expect(evaluateFlag(ruleset, none, "frontend.dark_mode", "client_C", true)).toEqual({
      value: false,
      source: "client_override",
    });
  });

  it("an emergency override beats a client override and the default", () => {
    const emergency = new Map([["billing.new_invoice_design", false]]);
    expect(evaluateFlag(ruleset, emergency, "billing.new_invoice_design", "client_A", true)).toEqual({
      value: false,
      source: "emergency_override",
    });
  });

  it("an emergency override works even with no ruleset at all (outage after restart)", () => {
    const emergency = new Map([["frontend.dark_mode", true]]);
    expect(evaluateFlag(null, emergency, "frontend.dark_mode", "client_C", false).source).toBe("emergency_override");
  });

  it("falls back to the in-code value for unknown flags", () => {
    expect(evaluateFlag(ruleset, none, "billing.does_not_exist", "client_A", true)).toEqual({
      value: true,
      source: "fallback",
      fallbackReason: "unknown_flag",
    });
  });

  it("falls back to the in-code value when no ruleset has ever been loaded", () => {
    expect(evaluateFlag(null, none, "frontend.dark_mode", "client_A", false)).toEqual({
      value: false,
      source: "fallback",
      fallbackReason: "no_ruleset",
    });
  });
});

describe("compileRuleset", () => {
  it("rejects malformed payloads so the caller keeps its last good copy", () => {
    expect(() => compileRuleset({ flags: {} })).toThrow(/version/);
    expect(() => compileRuleset({ version: 1, flags: { a: { default: "yes", overrides: {} } } })).toThrow(/malformed/);
    expect(() => compileRuleset({ version: 1, flags: { a: { default: true, overrides: { c: 1 } } } })).toThrow(/boolean/);
  });
});
