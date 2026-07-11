import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError } from "@/lib/validate";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { resolveApplicableNames } from "@/lib/promotions";
import { bulkNotify, resolvePromoRecipients } from "@/lib/notify";
import type { OfferApplicability } from "@/types/offer";

export async function GET() {
  try {
    await ensurePromotionColumns();
    const rows = await query<RowDataPacket[]>("SELECT * FROM coupons ORDER BY created_at DESC");
    const coupons = await Promise.all(rows.map(async (r) => {
      const applicability = (r.applicability || "store") as OfferApplicability;
      const applicable_ids: string[] = typeof r.applicable_ids === "string" ? JSON.parse(r.applicable_ids) : (r.applicable_ids as string[]) || [];
      return {
        ...r,
        is_active: !!r.is_active,
        // mysql2 returns DECIMAL columns as strings — normalize to numbers
        discount_value: Number(r.discount_value) || 0,
        min_order_amount: r.min_order_amount != null ? Number(r.min_order_amount) : null,
        max_discount_amount: r.max_discount_amount != null ? Number(r.max_discount_amount) : null,
        usage_limit: r.usage_limit != null ? Number(r.usage_limit) : null,
        per_customer_limit: r.per_customer_limit != null ? Number(r.per_customer_limit) : null,
        used_count: Number(r.used_count) || 0,
        applicability,
        applicable_ids,
        applicable_names: await resolveApplicableNames(applicability, applicable_ids),
        applicable_categories: typeof r.applicable_categories === "string" ? JSON.parse(r.applicable_categories) : r.applicable_categories || null,
        applicable_products: typeof r.applicable_products === "string" ? JSON.parse(r.applicable_products) : r.applicable_products || null,
      };
    }));
    return NextResponse.json(coupons);
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
    if (body.usage_limit !== undefined && body.usage_limit !== null && body.usage_limit !== "") {
      const usageLimitNum = Number(body.usage_limit);
      if (!Number.isFinite(usageLimitNum) || usageLimitNum <= 0) {
        return validationError("Usage limit must be greater than zero");
      }
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

    // Auto-notify applicable customers about the new coupon (non-blocking)
    if (body.is_active !== false) {
      try {
        const discountLabel = body.discount_type === "fixed" ? `৳${body.discount_value} off` : `${body.discount_value}% off`;
        const minOrder = body.min_order_amount ? ` on orders above ৳${body.min_order_amount}` : "";
        const recipients = await resolvePromoRecipients(body.applicability || "store", body.applicable_ids || []);
        await bulkNotify(recipients, {
          type: "promo",
          title: `New Coupon: ${body.code}`,
          message: `Use code ${body.code} for ${discountLabel}${minOrder}. ${body.description || "Apply it at checkout!"}`,
          link: "/cart",
        });
      } catch (err) {
        console.error("[coupons] notify failed:", err);
      }
    }

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    if (message.includes("Duplicate entry")) {
      return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
