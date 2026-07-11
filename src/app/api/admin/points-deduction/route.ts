import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validationError } from "@/lib/validate";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { DEFAULT_DEDUCTION_ENGINE_CONFIG, type DeductionEngineConfig, type DeductionRule } from "@/types/points-deduction-rules";

export const dynamic = "force-dynamic";
const SETTINGS_KEY = "points_deduction_engine";

// GET /api/admin/points-deduction — current rule config + last recorded run
export async function GET() {
  try {
    // Needed here too, not just inside the engine's run path — this route
    // queries points_deduction_runs.trigger_source directly, and a DB that
    // hasn't run an engine cycle yet (or predates this column) would 500
    // on that SELECT before ever reaching the migration that adds it.
    await ensurePromotionColumns();

    const [settingsRows, lastRunRows] = await Promise.all([
      query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = ?", [SETTINGS_KEY]),
      query<RowDataPacket[]>(
        "SELECT id, started_at, finished_at, trigger_source, rules_evaluated, customers_affected, total_points_deducted, summary FROM points_deduction_runs ORDER BY started_at DESC LIMIT 1"
      ),
    ]);

    let config: DeductionEngineConfig = DEFAULT_DEDUCTION_ENGINE_CONFIG;
    if (settingsRows.length > 0) {
      // The `settings.value` column is native JSON, so mysql2 already returns
      // it parsed as an object — only fall back to JSON.parse for a raw string.
      const raw = settingsRows[0].value;
      try {
        const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<DeductionEngineConfig>;
        config = { ...DEFAULT_DEDUCTION_ENGINE_CONFIG, ...parsed, items: Array.isArray(parsed.items) ? parsed.items : [] };
      } catch { /* fall back to default */ }
    }

    let lastRun = null;
    if (lastRunRows.length > 0) {
      const r = lastRunRows[0];
      let summary: unknown = null;
      try { summary = typeof r.summary === "string" ? JSON.parse(r.summary) : r.summary; } catch { /* leave null */ }
      lastRun = {
        runId: r.id as string,
        triggerSource: r.trigger_source as string,
        startedAt: r.started_at as string,
        finishedAt: r.finished_at as string | null,
        rulesEvaluated: Number(r.rules_evaluated) || 0,
        customersAffected: Number(r.customers_affected) || 0,
        totalPointsDeducted: Number(r.total_points_deducted) || 0,
        summary,
      };
    }

    return NextResponse.json({ config, lastRun });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

function validateConfig(config: DeductionEngineConfig): string | null {
  for (const rule of config.items) {
    if (!rule.name?.trim()) return `Every rule needs a name.`;
    if (rule.advancedEnabled) {
      if (!Number.isFinite(rule.repeatIntervalDays) || rule.repeatIntervalDays < 0) {
        return `"${rule.name}": repeat interval must be zero or a positive number of days.`;
      }
      if (!rule.notificationTitle?.trim()) return `"${rule.name}": notification title is required.`;
      if (!rule.notificationMessage?.trim()) return `"${rule.name}": notification message is required.`;
    }
    switch (rule.type) {
      case "inactivity":
        if (!rule.inactiveDays || rule.inactiveDays < 1) return `"${rule.name}": inactive-for days must be at least 1.`;
        if (!rule.deductionAmount || rule.deductionAmount < 1) return `"${rule.name}": deduction amount must be at least 1 point.`;
        break;
      case "points_expiry":
        if (!rule.expiryDays || rule.expiryDays < 1) return `"${rule.name}": expiry age must be at least 1 day.`;
        break;
      case "low_spend":
        if (!rule.windowDays || rule.windowDays < 1) return `"${rule.name}": spend window must be at least 1 day.`;
        if (rule.minSpendThreshold === undefined || rule.minSpendThreshold === null || rule.minSpendThreshold < 0) return `"${rule.name}": minimum spend is required.`;
        if (!rule.deductionAmount || rule.deductionAmount < 1) return `"${rule.name}": deduction amount must be at least 1 point.`;
        break;
      case "tier_based":
        if (rule.tierIds.length === 0) return `"${rule.name}": select at least one tier.`;
        if (!rule.deductionAmount || rule.deductionAmount < 1) return `"${rule.name}": deduction amount must be at least 1 point.`;
        break;
      case "return_abuse":
        if (!rule.minOrders || rule.minOrders < 1) return `"${rule.name}": minimum orders must be at least 1.`;
        if (!rule.returnRateThresholdPct || rule.returnRateThresholdPct <= 0) return `"${rule.name}": return rate threshold must be greater than 0%.`;
        if (!rule.deductionAmount || rule.deductionAmount < 1) return `"${rule.name}": deduction amount must be at least 1 point.`;
        break;
    }
  }
  return null;
}

// PUT /api/admin/points-deduction — save rule config
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const config: DeductionEngineConfig = {
      items: Array.isArray(body?.items) ? body.items as DeductionRule[] : [],
    };

    const error = validateConfig(config);
    if (error) return validationError(error);

    const value = JSON.stringify(config);
    await execute(
      "INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()",
      [SETTINGS_KEY, value, value]
    );
    await logActivity("Updated points deduction rules", "settings", SETTINGS_KEY);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
