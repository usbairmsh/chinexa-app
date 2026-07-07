import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { resolveApplicableNames } from "@/lib/promotions";
import type { OfferApplicability } from "@/types/offer";

export const dynamic = "force-dynamic";

// GET /api/delivery-rules — admin: fetch both rule rows (standard + express),
// creating them with defaults on first access since there are always exactly two.
export async function GET() {
  try {
    await ensurePromotionColumns();

    for (const ruleType of ["standard", "express"] as const) {
      const existing = await query<RowDataPacket[]>("SELECT id FROM delivery_rules WHERE rule_type = ?", [ruleType]);
      if (existing.length === 0) {
        await execute(
          "INSERT INTO delivery_rules (id, rule_type, is_active, applicability, applicable_ids) VALUES (?, ?, FALSE, 'store', ?)",
          [`delivery-${ruleType}`, ruleType, JSON.stringify([])]
        );
      }
    }

    const rows = await query<RowDataPacket[]>("SELECT * FROM delivery_rules ORDER BY rule_type ASC");
    const rules = await Promise.all(rows.map(async (r) => {
      const applicable_ids: string[] = typeof r.applicable_ids === "string" ? JSON.parse(r.applicable_ids) : r.applicable_ids || [];
      return {
        ...r,
        is_active: !!r.is_active,
        applicable_ids,
        applicable_names: await resolveApplicableNames(r.applicability as OfferApplicability, applicable_ids),
      };
    }));

    return NextResponse.json(rules);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// PUT /api/delivery-rules — admin: update one rule
// Body: { rule_type: "standard" | "express", is_active, applicability, applicable_ids }
export async function PUT(req: NextRequest) {
  try {
    await ensurePromotionColumns();
    const body = await req.json();
    const ruleType = body.rule_type === "express" ? "express" : body.rule_type === "standard" ? "standard" : null;
    if (!ruleType) return NextResponse.json({ error: "rule_type must be 'standard' or 'express'" }, { status: 400 });

    await execute(
      `INSERT INTO delivery_rules (id, rule_type, is_active, applicability, applicable_ids)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE is_active = VALUES(is_active), applicability = VALUES(applicability), applicable_ids = VALUES(applicable_ids)`,
      [
        `delivery-${ruleType}`, ruleType,
        body.is_active ? 1 : 0,
        body.applicability || "store",
        JSON.stringify(body.applicable_ids || []),
      ]
    );

    await logActivity(`Updated free ${ruleType} delivery rule`, "delivery_rule", ruleType);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
