import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import {
  enrichCartItems,
  getCustomerTier,
  itemMatchesApplicability,
  computeDiscount,
  type PromoContext,
} from "@/lib/promotions";
import type { OfferApplicability, DiscountType } from "@/types/offer";

export const dynamic = "force-dynamic";

interface CouponRow extends RowDataPacket {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  applicability: OfferApplicability | null;
  applicable_ids: string | string[] | null;
}

interface ValidateItem {
  product_id: string;
  variant_id?: string | null;
  price: number;
  quantity: number;
}

function fail(message: string) {
  return NextResponse.json({ valid: false, discount: 0, message });
}

/**
 * POST /api/coupons/validate
 * Body: { code, order_total?, items?: [...], customer_id? }
 * Validates a coupon against the customer, cart applicability, and both the
 * global and per-customer redemption limits, then returns the discount that
 * applies to the eligible portion of the cart.
 */
export async function POST(req: NextRequest) {
  try {
    await ensurePromotionColumns();
    const body = await req.json();
    const code: string = (body.code || "").trim();
    const customerId: string | null = body.customer_id || null;
    const rawItems: ValidateItem[] = Array.isArray(body.items) ? body.items : [];

    if (!code) return fail("Enter a coupon code");

    const rows = await query<CouponRow[]>(
      "SELECT * FROM coupons WHERE code = ? AND is_active = 1 LIMIT 1",
      [code]
    );
    if (rows.length === 0) return fail("Invalid coupon code");

    const coupon = rows[0];
    const now = new Date();

    // ─── Time window ───
    if (coupon.valid_from && new Date(coupon.valid_from) > now) return fail("This coupon is not active yet");
    if (coupon.valid_until && new Date(coupon.valid_until) < now) return fail("Coupon has expired");

    // ─── Global usage limit ───
    if (coupon.usage_limit != null && Number(coupon.used_count) >= Number(coupon.usage_limit)) {
      return fail("Coupon usage limit reached");
    }

    const applicability = (coupon.applicability || "store") as OfferApplicability;
    const applicableIds: string[] =
      typeof coupon.applicable_ids === "string" ? JSON.parse(coupon.applicable_ids) : coupon.applicable_ids || [];

    // ─── Customer / tier applicability + per-customer limit ───
    const isCustomerScoped = applicability === "customers" || applicability === "tiers";
    const hasPerCustomerLimit = coupon.per_customer_limit != null && Number(coupon.per_customer_limit) > 0;

    if ((isCustomerScoped || hasPerCustomerLimit) && !customerId) {
      return fail("Please sign in to use this coupon");
    }

    const tier = customerId ? await getCustomerTier(customerId) : null;
    const ctx: PromoContext = {
      customerId,
      tierName: tier?.name ?? null,
      tierId: tier?.id ?? null,
    };

    if (applicability === "customers" && !applicableIds.includes(customerId || "")) {
      return fail("This coupon is not available for your account");
    }
    // Tiers may be stored by id or name — accept either.
    if (
      applicability === "tiers" &&
      !(ctx.tierId && applicableIds.includes(ctx.tierId)) &&
      !(ctx.tierName && applicableIds.includes(ctx.tierName))
    ) {
      return fail("This coupon is only for specific membership tiers");
    }

    // Per-customer redemption limit: count this customer's prior non-cancelled orders with this code.
    if (hasPerCustomerLimit && customerId) {
      const usedRows = await query<RowDataPacket[]>(
        "SELECT COUNT(*) as cnt FROM orders WHERE customer_id = ? AND coupon_code = ? AND status <> 'cancelled'",
        [customerId, coupon.code]
      );
      const usedByCustomer = Number(usedRows[0]?.cnt) || 0;
      if (usedByCustomer >= Number(coupon.per_customer_limit)) {
        return fail("You have already used this coupon the maximum number of times");
      }
    }

    // ─── Determine the eligible base the coupon discounts ───
    // For product/category/subcategory-scoped coupons, only the matching cart
    // lines count toward the discount base. For store/customer/tier coupons the
    // whole order_total counts.
    let eligibleBase: number;
    if (rawItems.length > 0 && (applicability === "categories" || applicability === "subcategories" || applicability === "products")) {
      const items = await enrichCartItems(rawItems);
      eligibleBase = items
        .filter((i) => itemMatchesApplicability(i, applicability, applicableIds, ctx))
        .reduce((sum, i) => sum + i.price * i.quantity, 0);
      if (eligibleBase <= 0) return fail("This coupon does not apply to items in your cart");
    } else {
      eligibleBase = Number(body.order_total) || 0;
    }

    // ─── Minimum order amount (checked against the full order total) ───
    const orderTotal = Number(body.order_total) || eligibleBase;
    if (coupon.min_order_amount && orderTotal < Number(coupon.min_order_amount)) {
      return fail(`Minimum order ৳${Number(coupon.min_order_amount).toLocaleString("en-BD")} required`);
    }

    const discount = computeDiscount(
      eligibleBase,
      coupon.discount_type,
      Number(coupon.discount_value),
      coupon.max_discount_amount != null ? Number(coupon.max_discount_amount) : null
    );

    if (discount <= 0) return fail("This coupon does not apply to your cart");

    return NextResponse.json({
      valid: true,
      discount,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      max_discount_amount: coupon.max_discount_amount != null ? Number(coupon.max_discount_amount) : null,
      applicability,
      message: `Coupon applied! You save ৳${discount.toLocaleString("en-BD")}`,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
