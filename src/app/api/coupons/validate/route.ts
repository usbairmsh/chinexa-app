import { NextRequest, NextResponse } from "next/server";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { validateCoupon } from "@/lib/promotions";
import { publicServerError } from "@/lib/validate";

export const dynamic = "force-dynamic";

interface ValidateItem {
  product_id: string;
  variant_id?: string | null;
  price: number;
  quantity: number;
}

/**
 * POST /api/coupons/validate
 * Body: { code, order_total?, items?: [...], customer_id? }
 * Validates a coupon against the customer, cart applicability, and both the
 * global and per-customer redemption limits, then returns the discount that
 * applies to the eligible portion of the cart. Shares its logic with
 * /api/orders' authoritative re-check at order-creation time via
 * validateCoupon() in src/lib/promotions.ts.
 */
export async function POST(req: NextRequest) {
  try {
    await ensurePromotionColumns();
    const body = await req.json();
    const code: string = (body.code || "").trim().slice(0, 50);
    const customerId: string | null = body.customer_id || null;
    const rawItems: ValidateItem[] = Array.isArray(body.items) ? body.items : [];
    const orderTotalHint = body.order_total != null ? Number(body.order_total) || 0 : undefined;

    const result = await validateCoupon(code, customerId, rawItems, orderTotalHint);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return publicServerError("POST /api/coupons/validate", error);
  }
}
