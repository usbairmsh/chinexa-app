import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";

export const dynamic = "force-dynamic";

// GET /api/customers/[id]/coupons — get coupons assigned to this customer (direct + tier-based)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get customer's current tier based on points
    const balanceRows = await query<RowDataPacket[]>(
      "SELECT COALESCE(SUM(points), 0) as total_points FROM customer_points WHERE customer_id = ?",
      [id]
    );
    const totalPoints = Number(balanceRows[0]?.total_points) || 0;

    const tiers = await query<RowDataPacket[]>(
      "SELECT name FROM membership_tiers WHERE is_active = 1 AND min_points <= ? AND max_points >= ? LIMIT 1",
      [totalPoints, totalPoints]
    );
    const tierName = tiers.length > 0 ? (tiers[0].name as string) : null;

    // Get directly assigned coupons + tier-based coupons
    let whereClauses = "cc.customer_id = ?";
    const queryParams: (string | number | null)[] = [id];

    if (tierName) {
      whereClauses += " OR cc.tier_name = ?";
      queryParams.push(tierName);
    }

    const rows = await query<RowDataPacket[]>(
      `SELECT cc.*, c.code as coupon_code, c.description as coupon_description, c.discount_type, c.discount_value, c.valid_until, c.is_active as coupon_active
       FROM customer_coupons cc
       JOIN coupons c ON c.id = cc.coupon_id
       WHERE (${whereClauses}) AND c.is_active = 1
       ORDER BY cc.assigned_at DESC`,
      queryParams
    );

    const coupons = rows.map((r) => ({
      ...r,
      is_used: !!r.is_used,
      coupon_active: !!r.coupon_active,
    }));

    return NextResponse.json(coupons);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// POST /api/customers/[id]/coupons — assign a coupon to this customer
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { coupon_id } = body;

    if (!coupon_id) {
      return NextResponse.json({ error: "coupon_id is required" }, { status: 400 });
    }

    const entryId = `cc-${Date.now()}`;
    await execute(
      "INSERT INTO customer_coupons (id, coupon_id, customer_id) VALUES (?, ?, ?)",
      [entryId, coupon_id, id]
    );

    await logActivity("Assigned coupon to customer", "coupon", coupon_id, `Customer: ${id}`);
    return NextResponse.json({ success: true, id: entryId }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
