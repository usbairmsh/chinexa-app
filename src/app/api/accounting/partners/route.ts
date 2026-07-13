import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { validate, validationError } from "@/lib/validate";
import { logActivity } from "@/lib/log-activity";
import { ensureAccountingTables } from "@/lib/migrate-accounting";
import { requirePermission } from "@/lib/admin-permissions-server";

export async function GET() {
  try {
    await ensureAccountingTables();
    const partners = await query<RowDataPacket[]>("SELECT * FROM partners ORDER BY created_at");
    if (partners.length === 0) return NextResponse.json({ data: [] });

    const txnRows = await query<RowDataPacket[]>(
      "SELECT partner_id, type, COALESCE(SUM(amount),0) AS total FROM partner_transactions GROUP BY partner_id, type"
    );
    const totalsByPartner = new Map<string, { investment: number; withdrawal: number; profit_distribution: number }>();
    for (const row of txnRows) {
      const pid = row.partner_id as string;
      const entry = totalsByPartner.get(pid) || { investment: 0, withdrawal: 0, profit_distribution: 0 };
      entry[row.type as "investment" | "withdrawal" | "profit_distribution"] = Number(row.total) || 0;
      totalsByPartner.set(pid, entry);
    }

    const data = partners.map((p) => {
      const totals = totalsByPartner.get(p.id as string) || { investment: 0, withdrawal: 0, profit_distribution: 0 };
      const initialInvestment = Number(p.initial_investment) || 0;
      const currentEquity = initialInvestment + totals.investment - totals.withdrawal - totals.profit_distribution;
      return {
        id: p.id, name: p.name, email: p.email, phone: p.phone,
        initial_investment: initialInvestment,
        share_percentage: Number(p.share_percentage) || 0,
        join_date: p.join_date, is_active: !!p.is_active, notes: p.notes,
        current_equity: currentEquity,
      };
    });

    return NextResponse.json({ data });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "accounting", "add");
    if (denied) return denied;
    await ensureAccountingTables();
    const body = await req.json();
    const err = validate([
      { field: "name", value: body.name, rules: ["required", "string", { minLength: 2 }, { maxLength: 255 }], label: "Partner name" },
      { field: "share_percentage", value: Number(body.share_percentage), rules: ["required", "number", { range: [0, 100] }], label: "Share percentage" },
      { field: "join_date", value: body.join_date, rules: ["required", "string"], label: "Join date" },
    ]);
    if (err) return validationError(err);

    const id = `partner-${Date.now()}`;
    await execute(
      "INSERT INTO partners (id, name, email, phone, initial_investment, share_percentage, join_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, body.name.trim(), body.email || null, body.phone || null, Number(body.initial_investment) || 0, Number(body.share_percentage), body.join_date, body.notes || null]
    );
    await logActivity("Added partner", "partner", id, body.name);

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to add partner" }, { status: 500 });
  }
}
