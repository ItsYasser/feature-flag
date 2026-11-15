/** Wire format of GET /api/v1/rulesets/{env}. */
export interface RulesetPayload {
  env: string;
  version: number;
  flags: Record<string, { default: boolean; overrides: Record<string, boolean> }>;
}

export type EvaluationSource =
  | "emergency_override"
  | "client_override"
  | "env_default"
  | "fallback";

export interface Evaluation {
  value: boolean;
  source: EvaluationSource;
  /** Why we used the fallback, when we did. */
  fallbackReason?: "no_ruleset" | "unknown_flag";
}
