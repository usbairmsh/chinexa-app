import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { code, order_total } = await req.json();
    const rows = await query<RowDataPacket[]>("SELECT * FROM coupons WHERE code = ? AND is_active = 1 LIMIT 1", [code]);
    if (rows.length === 0) return NextResponse.json({ valid: false, discount: 0, message: "Invalid coupon code" });

    const coupon = rows[0];
    if (coupon.valid_until && new Date(coupon.valid_until as string) < new Date()) return NextResponse.json({ valid: false, discount: 0, message: "Coupon has expired" });
    if (coupon.usage_limit && (coupon.used_count as number) >= (coupon.usage_limit as number)) return NextResponse.json({ valid: false, discount: 0, message: "Coupon usage limit reached" });
    if (coupon.min_order_amount && order_total < Number(coupon.min_order_amount)) return NextResponse.json({ valid: false, discount: 0, message: `Minimum order ৳${coupon.min_order_amount}` });

    let discount = 0;
    if (coupon.discount_type === "percentage") {
      discount = (order_total * Number(coupon.discount_value)) / 100;
      if (coupon.max_discount_amount) discount = Math.min(discount, Number(coupon.max_discount_amount));
    } else {
      discount = Number(coupon.discount_value);
    }

    return NextResponse.json({ valid: true, discount: Math.round(discount), message: `Coupon applied! You save ৳${Math.round(discount)}` });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
