import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { bulkNotify, getTierCustomerIds } from "@/lib/notify";

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

    await logActivity("Assigned coupon", "coupon", couponId, tier_name ? `Tier: ${tier_name}` : `${inserted.length} customer(s)`);

    // Notify recipients that a coupon was added to their account (non-blocking)
    try {
      const couponRows = await query<RowDataPacket[]>(
        "SELECT code, discount_type, discount_value FROM coupons WHERE id = ? LIMIT 1",
        [couponId]
      );
      if (couponRows.length > 0) {
        const c = couponRows[0];
        const discountLabel = c.discount_type === "fixed" ? `৳${Number(c.discount_value)} off` : `${Number(c.discount_value)}% off`;
        const recipients: string[] = [];
        if (customer_ids && Array.isArray(customer_ids)) recipients.push(...customer_ids);
        if (tier_name) recipients.push(...(await getTierCustomerIds([tier_name])));
        await bulkNotify(recipients, {
          type: "promo",
          title: "A coupon was added to your account 🎁",
          message: `Coupon ${c.code} (${discountLabel}) is now available on your account. Use it at checkout!`,
          link: "/cart",
        });
      }
    } catch (err) {
      console.error("[coupon assign] notify failed:", err);
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
