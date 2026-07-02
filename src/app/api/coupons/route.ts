import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError } from "@/lib/validate";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";

export async function GET() {
  try {
    await ensurePromotionColumns();
    const rows = await query<RowDataPacket[]>("SELECT * FROM coupons ORDER BY created_at DESC");
    return NextResponse.json(rows.map((r) => ({
      ...r,
      is_active: !!r.is_active,
      applicability: r.applicability || "store",
      applicable_ids: typeof r.applicable_ids === "string" ? JSON.parse(r.applicable_ids) : r.applicable_ids || [],
      applicable_categories: typeof r.applicable_categories === "string" ? JSON.parse(r.applicable_categories) : r.applicable_categories || null,
      applicable_products: typeof r.applicable_products === "string" ? JSON.parse(r.applicable_products) : r.applicable_products || null,
    })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensurePromotionColumns();
    const body = await req.json();
    const err = validate([
      { field: "code", value: body.code, rules: ["required", "string", { minLength: 2 }], label: "Coupon code" },
      { field: "discount_value", value: Number(body.discount_value), rules: ["required", "number", "positive"], label: "Discount value" },
      { field: "discount_type", value: body.discount_type || "percentage", rules: [{ oneOf: ["percentage", "fixed"] }], label: "Discount type" },
    ]);
    if (err) return validationError(err);
    if (body.discount_type === "percentage" && Number(body.discount_value) > 100) {
      return validationError("Percentage discount cannot exceed 100%");
    }
    if (body.valid_from && body.valid_until && new Date(body.valid_from) >= new Date(body.valid_until)) {
      return validationError("Valid-from date must be before valid-until date");
    }
    const id = `coupon-${Date.now()}`;
    await execute(
      "INSERT INTO coupons (id, code, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, per_customer_limit, valid_from, valid_until, is_active, applicability, applicable_ids, applicable_categories, applicable_products) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id, body.code, body.description || null,
        body.discount_type || "percentage", body.discount_value || 0,
        body.min_order_amount || null, body.max_discount_amount || null,
        body.usage_limit || null,
        body.per_customer_limit != null && body.per_customer_limit !== "" ? Number(body.per_customer_limit) : null,
        body.valid_from || null, body.valid_until || null,
        body.is_active !== false ? 1 : 0,
        body.applicability || "store",
        JSON.stringify(body.applicable_ids || []),
        body.applicable_categories ? JSON.stringify(body.applicable_categories) : null,
        body.applicable_products ? JSON.stringify(body.applicable_products) : null,
      ]
    );
    await logActivity("Created coupon", "coupon", id, body.code);
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    if (message.includes("Duplicate entry")) {
      return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
