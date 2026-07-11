export type DeductionRuleType = "inactivity" | "points_expiry" | "low_spend" | "tier_based" | "return_abuse";

interface DeductionRuleBase {
  id: string;
  type: DeductionRuleType;
  enabled: boolean;
  /** Admin-facing label, e.g. "Inactive 90+ days". */
  name: string;
  /** Whether this rule's own advanced settings (interval/notification) are
   * expanded and in effect. When false, the rule uses the built-in defaults. */
  advancedEnabled: boolean;
  /** Cooldown (days) before THIS rule can fire again on the same customer.
   * 0 means no cooldown. Not applicable to instant-only Tier-Based/Return-Abuse
   * rules (they skip the cooldown gate entirely while Instant is on). */
  repeatIntervalDays: number;
  /** Notification shown to the customer when THIS rule deducts their points.
   * Supports {points} and {rule} tokens. */
  notificationTitle: string;
  notificationMessage: string;
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
}

export interface LowSpendRule extends DeductionRuleBase {
  type: "low_spend";
  /** Rolling window (days) the spend total is measured over. */
  windowDays: number;
  /** Deduct if spend within the window is below this amount. */
  minSpendThreshold: number;
  deductionAmount: number;
}

export interface TierBasedRule extends DeductionRuleBase {
  type: "tier_based";
  /** membership_tiers.id — customer must currently be in one of these. */
  tierIds: string[];
  deductionAmount: number;
  /** Re-check this customer the instant their points balance changes,
   * instead of waiting for the next scheduled run. */
  instant: boolean;
}

export interface ReturnAbuseRule extends DeductionRuleBase {
  type: "return_abuse";
  /** Minimum lifetime orders before this rule can apply. */
  minOrders: number;
  /** Deduct if (returns / orders) * 100 exceeds this percentage. */
  returnRateThresholdPct: number;
  deductionAmount: number;
  /** Re-check this customer the instant a return of theirs is approved,
   * instead of waiting for the next scheduled run. */
  instant: boolean;
}

export type DeductionRule =
  | InactivityRule | PointsExpiryRule | LowSpendRule | TierBasedRule | ReturnAbuseRule;

export interface DeductionEngineConfig {
  items: DeductionRule[];
}

export const DEFAULT_DEDUCTION_ENGINE_CONFIG: DeductionEngineConfig = {
  items: [],
};

/** Built-in defaults used by any rule that hasn't opened its own advanced settings. */
export const DEFAULT_RULE_INTERVAL_DAYS = 30;
export const DEFAULT_RULE_NOTIFICATION_TITLE = "Points deducted";
export const DEFAULT_RULE_NOTIFICATION_MESSAGE = "{points} points were deducted from your account.";

export type TriggerSource = "scheduled" | "manual" | "instant";

/** Per-customer result from a single rule during one engine run, persisted to
 * points_deduction_run_customers so the Engine Activity Log can show it. */
export interface RuleCustomerResult {
  customerId: string;
  outcome: "deducted" | "skipped_no_balance" | "error";
  pointsDeducted: number;
  /** Human-readable snapshot of the specific values that matched, e.g.
   * "No order in 97 days (threshold: 90)" — computed at match time since the
   * underlying data (last order date, spend, etc.) can change afterward. */
  matchedCriteria: string;
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
  runId: string;
  triggerSource: TriggerSource;
  startedAt: string;
  finishedAt: string;
  rulesEvaluated: number;
  customersAffected: number;
  totalPointsDeducted: number;
  perRule: RuleRunSummary[];
  errors: string[];
}

/** One row in points_deduction_run_customers, as returned by the activity-log API. */
export interface ActivityLogCustomerRow {
  id: string;
  runId: string;
  ruleId: string;
  ruleName: string;
  ruleType: DeductionRuleType;
  customerId: string;
  customerName: string;
  customerPhone: string;
  outcome: "deducted" | "skipped_no_balance" | "error";
  pointsDeducted: number;
  matchedCriteria: string;
  errorMessage: string | null;
  createdAt: string;
  reversedAt: string | null;
  disbursedAt: string | null;
}

/** One row in points_deduction_runs, as returned by the run-history API. */
export interface RunHistoryEntry {
  runId: string;
  triggerSource: TriggerSource;
  ranAt: string;
  candidates: number;
  customersAffected: number;
  errorCount: number;
  pointsDeducted: number;
}
