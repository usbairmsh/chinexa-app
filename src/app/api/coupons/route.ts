import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";

export async function GET() {
  try {
    const rows = await query<RowDataPacket[]>("SELECT * FROM coupons ORDER BY created_at DESC");
    return NextResponse.json(rows.map((r) => ({ ...r, is_active: !!r.is_active, applicable_categories: r.applicable_categories ? JSON.parse(r.applicable_categories as string) : null, applicable_products: r.applicable_products ? JSON.parse(r.applicable_products as string) : null })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = `coupon-${Date.now()}`;
    await execute(
      "INSERT INTO coupons (id, code, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, valid_from, valid_until, is_active, applicable_categories, applicable_products) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, body.code, body.description || null, body.discount_type || "percentage", body.discount_value || 0, body.min_order_amount || null, body.max_discount_amount || null, body.usage_limit || null, body.valid_from || null, body.valid_until || null, body.is_active !== false ? 1 : 0, body.applicable_categories ? JSON.stringify(body.applicable_categories) : null, body.applicable_products ? JSON.stringify(body.applicable_products) : null]
    );
    await logActivity("Created coupon", "coupon", id, body.code);
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
