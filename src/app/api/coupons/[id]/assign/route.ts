import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";

// POST /api/coupons/[id]/assign — assign coupon to customer(s) or tier
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: couponId } = await params;
    const body = await req.json();
    const { customer_ids, tier_name } = body;

    if (!customer_ids && !tier_name) {
      return NextResponse.json({ error: "customer_ids or tier_name required" }, { status: 400 });
    }

    const inserted: string[] = [];

    // Assign to specific customers
    if (customer_ids && Array.isArray(customer_ids)) {
      for (const customerId of customer_ids) {
        const entryId = `cc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await execute(
          "INSERT INTO customer_coupons (id, coupon_id, customer_id) VALUES (?, ?, ?)",
          [entryId, couponId, customerId]
        );
        inserted.push(entryId);
      }
    }

    // Assign to tier (all current + future members)
    if (tier_name) {
      const entryId = `cc-tier-${Date.now()}`;
      await execute(
        "INSERT INTO customer_coupons (id, coupon_id, tier_name) VALUES (?, ?, ?)",
        [entryId, couponId, tier_name]
      );
      inserted.push(entryId);
    }

    return NextResponse.json({ success: true, assigned: inserted.length }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// GET /api/coupons/[id]/assign — list who this coupon is assigned to
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: couponId } = await params;
    const rows = await query<RowDataPacket[]>(
      `SELECT cc.*, c.name as customer_name, c.phone as customer_phone
       FROM customer_coupons cc
       LEFT JOIN customers c ON c.id = cc.customer_id
       WHERE cc.coupon_id = ?
       ORDER BY cc.assigned_at DESC`,
      [couponId]
    );
    return NextResponse.json(rows.map((r) => ({ ...r, is_used: !!r.is_used })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
