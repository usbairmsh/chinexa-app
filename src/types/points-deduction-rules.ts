export type DeductionRuleType =
  | "inactivity" | "points_expiry" | "low_spend" | "flat_decay" | "tier_based" | "return_abuse";

export interface DeductionNotification {
  title: string;
  message: string;
}

interface DeductionRuleBase {
  id: string;
  type: DeductionRuleType;
  enabled: boolean;
  /** Admin-facing label, e.g. "Inactive 90+ days". */
  name: string;
  /** Cooldown, in days, before this rule can fire on the same customer again. */
  repeatIntervalDays: number;
  notification: DeductionNotification;
}

export interface InactivityRule extends DeductionRuleBase {
  type: "inactivity";
  /** Days since last_order_at (or created_at if the customer never ordered). */
  inactiveDays: number;
  deductionAmount: number;
}

export interface PointsExpiryRule extends DeductionRuleBase {
  type: "points_expiry";
  /** Points earned longer ago than this (days) are eligible to expire. */
  expiryDays: number;
  /** Optional cap on how many points a single run can expire from one customer. */
  capAmount?: number;
}

export interface LowSpendRule extends DeductionRuleBase {
  type: "low_spend";
  /** Rolling window (days) the spend total is measured over. */
  windowDays: number;
  /** Deduct if spend within the window is below this amount. */
  minSpendThreshold: number;
  deductionAmount: number;
  /** Optional gates — only customers meeting ALL enabled gates are considered. */
  requireMinAccountAgeDays?: number;
  requireMinLifetimeOrders?: number;
}

export interface FlatDecayRule extends DeductionRuleBase {
  type: "flat_decay";
  deductionAmount: number;
}

export interface TierBasedRule extends DeductionRuleBase {
  type: "tier_based";
  /** membership_tiers.id — customer must currently be in one of these. */
  tierIds: string[];
  deductionAmount: number;
}

export interface ReturnAbuseRule extends DeductionRuleBase {
  type: "return_abuse";
  /** Minimum lifetime (or lookback-window) orders before this rule can apply. */
  minOrders: number;
  /** Deduct if (returns / orders) * 100 exceeds this percentage. */
  returnRateThresholdPct: number;
  /** Optional — omit or 0 means all-time. */
  lookbackDays?: number;
  deductionAmount: number;
}

export type DeductionRule =
  | InactivityRule | PointsExpiryRule | LowSpendRule
  | FlatDecayRule | TierBasedRule | ReturnAbuseRule;

export interface DeductionRuleConfig {
  items: DeductionRule[];
}

export const DEFAULT_DEDUCTION_RULE_CONFIG: DeductionRuleConfig = { items: [] };

/** Per-customer result from a single rule during one engine run. */
export interface RuleCustomerResult {
  customerId: string;
  pointsDeducted: number;
  skipped?: "no_balance" | "cooldown" | "error";
  error?: string;
}

export interface RuleRunSummary {
  ruleId: string;
  ruleName: string;
  type: DeductionRuleType;
  candidates: number;
  customersAffected: number;
  pointsDeducted: number;
  errors: string[];
}

export interface EngineRunSummary {
  startedAt: string;
  finishedAt: string;
  rulesEvaluated: number;
  customersAffected: number;
  totalPointsDeducted: number;
  perRule: RuleRunSummary[];
  errors: string[];
}
