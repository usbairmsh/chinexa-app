import { query, execute } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { bulkNotify } from "@/lib/notify";
import { insertCustomerPoints } from "@/lib/points";
import type {
  DeductionRule, DeductionEngineConfig, EngineRunSummary, RuleRunSummary, TriggerSource,
  TierBasedRule, ReturnAbuseRule,
} from "@/types/points-deduction-rules";
import { DEFAULT_DEDUCTION_ENGINE_CONFIG } from "@/types/points-deduction-rules";

const SETTINGS_KEY = "points_deduction_engine";

interface Candidate {
  id: string;
  /** Human-readable snapshot of the specific values that matched this rule. */
  criteria: string;
}

async function loadConfig(): Promise<DeductionEngineConfig> {
  const rows = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = ?", [SETTINGS_KEY]);
  if (rows.length === 0) return DEFAULT_DEDUCTION_ENGINE_CONFIG;
  try {
    const parsed = JSON.parse(rows[0].value as string) as Partial<DeductionEngineConfig>;
    return { ...DEFAULT_DEDUCTION_ENGINE_CONFIG, ...parsed, items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return DEFAULT_DEDUCTION_ENGINE_CONFIG;
  }
}

/** Customers still within the shared cooldown, based on their last ledger
 * entry for this specific rule. repeatIntervalDays <= 0 means no cooldown. */
async function getCustomersInCooldown(ruleId: string, repeatIntervalDays: number, customerIds: string[]): Promise<Set<string>> {
  if (customerIds.length === 0) return new Set();
  if (repeatIntervalDays <= 0) return new Set();
  const placeholders = customerIds.map(() => "?").join(",");
  const rows = await query<RowDataPacket[]>(
    `SELECT customer_id, MAX(created_at) AS last_fired
     FROM customer_points
     WHERE type = 'rule_deduction' AND reference_id = ? AND customer_id IN (${placeholders})
     GROUP BY customer_id`,
    [ruleId, ...customerIds]
  );
  const cutoffMs = Date.now() - repeatIntervalDays * 86400000;
  const inCooldown = new Set<string>();
  for (const r of rows) {
    const lastFired = new Date(r.last_fired as string).getTime();
    if (lastFired > cutoffMs) inCooldown.add(r.customer_id as string);
  }
  return inCooldown;
}

async function getCurrentBalance(customerId: string): Promise<number> {
  const rows = await query<RowDataPacket[]>(
    "SELECT COALESCE(SUM(points), 0) AS total FROM customer_points WHERE customer_id = ?",
    [customerId]
  );
  return Number(rows[0]?.total) || 0;
}

/** Candidate customers for a rule, before cooldown filtering, each tagged
 * with a human-readable snapshot of the values that matched. When
 * `onlyCustomerId` is set, the query is scoped to that one customer (used by
 * the instant single-customer checks) instead of scanning the whole base. */
async function getCandidates(rule: DeductionRule, onlyCustomerId?: string): Promise<Candidate[]> {
  switch (rule.type) {
    case "inactivity": {
      const rows = await query<RowDataPacket[]>(
        `SELECT id, last_order_at, created_at FROM customers
         WHERE is_active = 1
           AND (
             (last_order_at IS NOT NULL AND last_order_at <= DATE_SUB(NOW(), INTERVAL ? DAY))
             OR (last_order_at IS NULL AND created_at <= DATE_SUB(NOW(), INTERVAL ? DAY))
           )
           ${onlyCustomerId ? "AND id = ?" : ""}`,
        onlyCustomerId ? [rule.inactiveDays, rule.inactiveDays, onlyCustomerId] : [rule.inactiveDays, rule.inactiveDays]
      );
      const now = Date.now();
      return rows.map((r) => {
        const since = r.last_order_at ? new Date(r.last_order_at as string) : new Date(r.created_at as string);
        const days = Math.floor((now - since.getTime()) / 86400000);
        const basis = r.last_order_at ? "last order" : "signup, never ordered";
        return { id: r.id as string, criteria: `${days} days since ${basis} (threshold: ${rule.inactiveDays})` };
      });
    }

    case "points_expiry": {
      const rows = await query<RowDataPacket[]>(
        `SELECT customer_id, SUM(points) AS expiring_points FROM customer_points
         WHERE created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
           ${onlyCustomerId ? "AND customer_id = ?" : ""}
         GROUP BY customer_id
         HAVING SUM(points) > 0`,
        onlyCustomerId ? [rule.expiryDays, onlyCustomerId] : [rule.expiryDays]
      );
      return rows.map((r) => ({
        id: r.customer_id as string,
        criteria: `${Number(r.expiring_points) || 0} points earned more than ${rule.expiryDays} days ago`,
      }));
    }

    case "low_spend": {
      const params: (string | number)[] = [rule.windowDays];
      let where = "WHERE c.is_active = 1";
      if (onlyCustomerId) {
        where += " AND c.id = ?";
        params.push(onlyCustomerId);
      }
      params.push(rule.minSpendThreshold);
      const rows = await query<RowDataPacket[]>(
        `SELECT c.id, COALESCE(SUM(o.total), 0) AS window_spend
         FROM customers c
         LEFT JOIN orders o ON o.customer_id = c.id
           AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
           AND o.status <> 'cancelled'
         ${where}
         GROUP BY c.id
         HAVING window_spend < ?`,
        params
      );
      return rows.map((r) => ({
        id: r.id as string,
        criteria: `Spent ${Number(r.window_spend) || 0} in last ${rule.windowDays} days (threshold: ${rule.minSpendThreshold})`,
      }));
    }

    case "tier_based": {
      if (rule.tierIds.length === 0) return [];
      const placeholders = rule.tierIds.map(() => "?").join(",");
      const tiers = await query<RowDataPacket[]>(
        `SELECT id, name, min_points, max_points FROM membership_tiers WHERE id IN (${placeholders}) AND is_active = 1`,
        rule.tierIds
      );
      if (tiers.length === 0) return [];
      const balanceWhere = onlyCustomerId ? "WHERE c.is_active = 1 AND c.id = ?" : "WHERE c.is_active = 1";
      const balanceParams = onlyCustomerId ? [onlyCustomerId] : [];
      const balances = await query<RowDataPacket[]>(
        `SELECT c.id, COALESCE(SUM(cp.points), 0) AS total_points
         FROM customers c LEFT JOIN customer_points cp ON cp.customer_id = c.id
         ${balanceWhere}
         GROUP BY c.id`,
        balanceParams
      );
      const matches: Candidate[] = [];
      for (const b of balances) {
        const total = Number(b.total_points) || 0;
        const tier = tiers.find((t) => total >= Number(t.min_points) && total <= Number(t.max_points));
        if (tier) matches.push({ id: b.id as string, criteria: `In tier "${tier.name}" with ${total} points` });
      }
      return matches;
    }

    case "return_abuse": {
      const params: (string | number)[] = [];
      let where = "WHERE o.customer_id IS NOT NULL AND o.status <> 'cancelled'";
      if (onlyCustomerId) {
        where += " AND o.customer_id = ?";
        params.push(onlyCustomerId);
      }
      params.push(rule.minOrders, rule.returnRateThresholdPct);
      const rows = await query<RowDataPacket[]>(
        `SELECT o.customer_id,
                COUNT(DISTINCT o.id) AS order_count,
                COUNT(DISTINCT r.id) AS return_count
         FROM orders o
         LEFT JOIN order_returns r ON r.order_id = o.id AND r.status <> 'rejected'
         ${where}
         GROUP BY o.customer_id
         HAVING order_count >= ? AND (return_count / order_count) * 100 > ?`,
        params
      );
      return rows.map((r) => {
        const orderCount = Number(r.order_count) || 0;
        const returnCount = Number(r.return_count) || 0;
        const pct = orderCount > 0 ? Math.round((returnCount / orderCount) * 1000) / 10 : 0;
        return {
          id: r.customer_id as string,
          criteria: `${returnCount}/${orderCount} orders returned (${pct}%, threshold: ${rule.returnRateThresholdPct}%)`,
        };
      });
    }
  }
}

/** Points to deduct for one candidate customer, given the rule and their current balance. */
async function computeDeduction(rule: DeductionRule, customerId: string, currentBalance: number): Promise<number> {
  if (rule.type === "points_expiry") {
    const rows = await query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(points), 0) AS expiring
       FROM customer_points WHERE customer_id = ? AND created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [customerId, rule.expiryDays]
    );
    const amount = Math.max(0, Number(rows[0]?.expiring) || 0);
    return Math.min(amount, currentBalance);
  }
  return Math.min(rule.deductionAmount, currentBalance);
}

function interpolate(template: string, tokens: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => (key in tokens ? String(tokens[key]) : `{${key}}`));
}

/** Best-effort activity-log row insert. Never throws — a logging failure
 * shouldn't undo a deduction that already happened. */
async function logCustomerResult(
  runId: string, rule: DeductionRule, customerId: string, criteria: string,
  outcome: "deducted" | "skipped_no_balance" | "error",
  pointsDeducted: number, pointsEntryId: string | null, errorMessage: string | null
): Promise<void> {
  const rowId = `pdrc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await execute(
    `INSERT INTO points_deduction_run_customers
     (id, run_id, rule_id, rule_name, rule_type, customer_id, outcome, points_deducted, matched_criteria, error_message, points_entry_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [rowId, runId, rule.id, rule.name, rule.type, customerId, outcome, pointsDeducted, criteria, errorMessage, pointsEntryId]
  );
}

async function runRule(
  runId: string, rule: DeductionRule, config: DeductionEngineConfig, onlyCustomerId?: string
): Promise<RuleRunSummary> {
  const summary: RuleRunSummary = {
    ruleId: rule.id, ruleName: rule.name, type: rule.type,
    candidates: 0, customersAffected: 0, pointsDeducted: 0, errors: [],
  };

  let candidates: Candidate[] = [];
  try {
    candidates = await getCandidates(rule, onlyCustomerId);
  } catch (err) {
    summary.errors.push(`candidate query failed: ${err instanceof Error ? err.message : String(err)}`);
    return summary;
  }
  summary.candidates = candidates.length;
  if (candidates.length === 0) return summary;

  let eligible: Candidate[];
  try {
    const inCooldown = await getCustomersInCooldown(rule.id, config.repeatIntervalDays, candidates.map((c) => c.id));
    eligible = candidates.filter((c) => !inCooldown.has(c.id));
  } catch (err) {
    summary.errors.push(`cooldown check failed: ${err instanceof Error ? err.message : String(err)}`);
    return summary;
  }

  for (const { id: customerId, criteria } of eligible) {
    try {
      const balance = await getCurrentBalance(customerId);
      if (balance <= 0) {
        await logCustomerResult(runId, rule, customerId, criteria, "skipped_no_balance", 0, null, null).catch(() => {});
        continue;
      }

      const amount = await computeDeduction(rule, customerId, balance);
      if (amount <= 0) {
        await logCustomerResult(runId, rule, customerId, criteria, "skipped_no_balance", 0, null, null).catch(() => {});
        continue;
      }

      const entryId = await insertCustomerPoints({
        customerId, points: -amount, type: "rule_deduction", referenceId: rule.id,
        description: `Rule deduction: ${rule.name}`,
      });

      const title = interpolate(config.notificationTitle, { points: amount, rule: rule.name });
      const message = interpolate(config.notificationMessage, { points: amount, rule: rule.name });
      await bulkNotify([customerId], { type: "loyalty", title, message }).catch(() => {});

      await logCustomerResult(runId, rule, customerId, criteria, "deducted", amount, entryId, null).catch(() => {});

      summary.customersAffected += 1;
      summary.pointsDeducted += amount;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push(`customer ${customerId}: ${message}`);
      await logCustomerResult(runId, rule, customerId, criteria, "error", 0, null, message).catch(() => {});
    }
  }

  return summary;
}

async function runRules(rules: DeductionRule[], config: DeductionEngineConfig, triggerSource: TriggerSource, onlyCustomerId?: string): Promise<EngineRunSummary> {
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const startedAt = new Date().toISOString();
  const setupErrors: string[] = [];

  try {
    await ensurePromotionColumns();
  } catch (err) {
    setupErrors.push(`schema migration failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const perRule: RuleRunSummary[] = [];
  for (const rule of rules) {
    perRule.push(await runRule(runId, rule, config, onlyCustomerId));
  }

  const finishedAt = new Date().toISOString();
  const customersAffected = perRule.reduce((s, r) => s + r.customersAffected, 0);
  const totalPointsDeducted = perRule.reduce((s, r) => s + r.pointsDeducted, 0);
  const errors = [...setupErrors, ...perRule.flatMap((r) => r.errors)];

  const summary: EngineRunSummary = {
    runId, triggerSource, startedAt, finishedAt,
    rulesEvaluated: rules.length, customersAffected, totalPointsDeducted, perRule, errors,
  };

  // Only persist a run record when there was actually something to evaluate —
  // an instant check that found zero applicable rules for this customer
  // shouldn't spam the activity log with empty rows on every single order/return.
  if (rules.length > 0) {
    try {
      await execute(
        `INSERT INTO points_deduction_runs
         (id, started_at, finished_at, trigger_source, rules_evaluated, customers_affected, total_points_deducted, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [runId, startedAt, finishedAt, triggerSource, rules.length, customersAffected, totalPointsDeducted, JSON.stringify(summary)]
      );
    } catch (err) {
      console.error("[points-deduction-engine] failed to record run:", err);
    }
  }

  return summary;
}

/** Full evaluation of every enabled rule against the entire customer base —
 * used by the hourly scheduler and the admin "Run Now" button. */
export async function runPointsDeductionEngine(triggerSource: "scheduled" | "manual"): Promise<EngineRunSummary> {
  const config = await loadConfig();
  const rules = config.items.filter((r) => r.enabled);
  return runRules(rules, config, triggerSource);
}

/** Re-checks only enabled, instant tier-based rules against ONE customer —
 * called from insertCustomerPoints() every time that customer's balance
 * changes, regardless of which route caused the change. */
export async function checkInstantTierRules(customerId: string): Promise<EngineRunSummary> {
  const config = await loadConfig();
  const rules = config.items.filter(
    (r): r is TierBasedRule => r.enabled && r.type === "tier_based" && r.instant
  );
  return runRules(rules, config, "instant", customerId);
}

/** Re-checks only enabled, instant return-abuse rules against ONE customer —
 * called the moment a return is approved for them. */
export async function checkInstantReturnAbuseRules(customerId: string): Promise<EngineRunSummary> {
  const config = await loadConfig();
  const rules = config.items.filter(
    (r): r is ReturnAbuseRule => r.enabled && r.type === "return_abuse" && r.instant
  );
  return runRules(rules, config, "instant", customerId);
}
