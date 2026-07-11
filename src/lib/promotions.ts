import { query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import type { OfferApplicability, DiscountType } from "@/types/offer";

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

export interface PromoCartItem {
  product_id: string;
  variant_id?: string | null;
  price: number;
  quantity: number;
  category_id?: string | null;
  subcategory?: string | null;
  brand_id?: string | null;
}

export interface PromoContext {
  customerId?: string | null;
  tierName?: string | null;
  tierId?: string | null;
}

/** Look up a customer's current membership tier from their points balance. */
export async function getCustomerTier(customerId: string): Promise<{ id: string; name: string } | null> {
  const balanceRows = await query<RowDataPacket[]>(
    "SELECT COALESCE(SUM(points), 0) as total_points FROM customer_points WHERE customer_id = ?",
    [customerId]
  );
  const totalPoints = Number(balanceRows[0]?.total_points) || 0;
  const tiers = await query<RowDataPacket[]>(
    "SELECT id, name FROM membership_tiers WHERE is_active = 1 AND min_points <= ? AND max_points >= ? LIMIT 1",
    [totalPoints, totalPoints]
  );
  return tiers.length > 0 ? { id: tiers[0].id as string, name: tiers[0].name as string } : null;
}

/**
 * Resolve human-readable names for a promotion's applicable_ids so admin UIs
 * can label chips instead of showing raw IDs.
 */
export async function resolveApplicableNames(
  applicability: OfferApplicability,
  ids: string[]
): Promise<string[]> {
  if (!Array.isArray(ids) || ids.length === 0 || applicability === "store") return [];
  const placeholders = ids.map(() => "?").join(",");
  try {
    let rows: RowDataPacket[] = [];
    if (applicability === "categories" || applicability === "subcategories") {
      rows = await query<RowDataPacket[]>(`SELECT id, name FROM categories WHERE id IN (${placeholders})`, ids);
    } else if (applicability === "products") {
      rows = await query<RowDataPacket[]>(`SELECT id, name FROM products WHERE id IN (${placeholders})`, ids);
    } else if (applicability === "brands") {
      rows = await query<RowDataPacket[]>(`SELECT id, name FROM brands WHERE id IN (${placeholders})`, ids);
    } else if (applicability === "customers") {
      rows = await query<RowDataPacket[]>(`SELECT id, name FROM customers WHERE id IN (${placeholders})`, ids);
    } else if (applicability === "tiers") {
      // Tiers may be stored by id or by name — resolve both
      rows = await query<RowDataPacket[]>(`SELECT id, name FROM membership_tiers WHERE id IN (${placeholders}) OR name IN (${placeholders})`, [...ids, ...ids]);
    }
    const byId = new Map(rows.map((r) => [r.id as string, r.name as string]));
    const byName = new Set(rows.map((r) => r.name as string));
    return ids.map((id) => byId.get(id) || (byName.has(id) ? id : id));
  } catch {
    return ids; // fall back to raw ids on any lookup failure
  }
}

/**
 * Enrich cart items with category_id/subcategory from the DB so applicability
 * can be evaluated authoritatively (the client cannot be trusted for this).
 *
 * The per-unit price is recomputed server-side as
 * `product.price + variant.price_adjustment` for the selected variant, so
 * discounts are calculated on the exact line price the customer pays — variant
 * price adjustments included — rather than the raw base product price.
 */
export async function enrichCartItems(
  items: { product_id: string; variant_id?: string | null; price: number; quantity: number }[]
): Promise<PromoCartItem[]> {
  const productIds = [...new Set(items.map((i) => i.product_id))];
  if (productIds.length === 0) return [];

  // Look up any selected variants so we can apply their price adjustment.
  const variantIds = [...new Set(items.map((i) => i.variant_id).filter((v): v is string => !!v))];

  const productPlaceholders = productIds.map(() => "?").join(",");
  const [productRows, variantRows] = await Promise.all([
    query<RowDataPacket[]>(
      `SELECT id, category_id, subcategory, brand_id, price FROM products WHERE id IN (${productPlaceholders})`,
      productIds
    ),
    variantIds.length > 0
      ? query<RowDataPacket[]>(
          `SELECT id, price_adjustment FROM product_variants WHERE id IN (${variantIds.map(() => "?").join(",")})`,
          variantIds
        )
      : Promise.resolve([] as RowDataPacket[]),
  ]);
  const productById = new Map(productRows.map((r) => [r.id as string, r]));
  const adjustmentByVariant = new Map<string, number>();
  for (const v of variantRows) {
    adjustmentByVariant.set(v.id as string, Number(v.price_adjustment) || 0);
  }

  return items.map((i) => {
    const p = productById.get(i.product_id);
    // Authoritative unit price = base price + selected variant's adjustment.
    // Fall back to the client-supplied price only if the product row is missing.
    const authoritativePrice = p
      ? Number(p.price) + (i.variant_id ? (adjustmentByVariant.get(i.variant_id) ?? 0) : 0)
      : i.price;
    return {
      product_id: i.product_id,
      variant_id: i.variant_id ?? null,
      price: authoritativePrice,
      quantity: i.quantity,
      category_id: p ? (p.category_id as string | null) : null,
      subcategory: p ? (p.subcategory as string | null) : null,
      brand_id: p ? (p.brand_id as string | null) : null,
    };
  });
}

/** Does a promotion with the given applicability apply to a specific cart item? */
export function itemMatchesApplicability(
  item: PromoCartItem,
  applicability: OfferApplicability,
  applicableIds: string[],
  ctx: PromoContext
): boolean {
  switch (applicability) {
    case "store":
      return true;
    case "categories":
      return !!item.category_id && applicableIds.includes(item.category_id);
    case "subcategories":
      return !!item.subcategory && applicableIds.includes(item.subcategory);
    case "products":
      return applicableIds.includes(item.product_id);
    case "brands":
      return !!item.brand_id && applicableIds.includes(item.brand_id);
    case "customers":
      // Customer-scoped promos apply to the whole cart, but only for the named customers.
      return !!ctx.customerId && applicableIds.includes(ctx.customerId);
    case "tiers":
      // Admin UIs may store tier ids or tier names — accept either.
      return (
        (!!ctx.tierId && applicableIds.includes(ctx.tierId)) ||
        (!!ctx.tierName && applicableIds.includes(ctx.tierName))
      );
    default:
      return false;
  }
}

/**
 * Compute the discount amount a percentage/fixed promotion yields on a base amount.
 * For "fixed" the value is the flat amount; for "percentage" it is a percent of base.
 * The result is capped at maxDiscount (if provided) and never exceeds the base.
 */
export function computeDiscount(
  base: number,
  discountType: DiscountType,
  discountValue: number,
  maxDiscount?: number | null
): number {
  if (base <= 0 || discountValue <= 0) return 0;
  let amount = discountType === "percentage" ? (base * discountValue) / 100 : discountValue;
  if (maxDiscount != null && maxDiscount > 0) amount = Math.min(amount, maxDiscount);
  return Math.min(Math.round(amount), base);
}

export interface ActiveOffer {
  id: string;
  title: string;
  applicability: OfferApplicability;
  applicable_ids: string[];
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount: number | null;
}

/** Every currently-active, in-date-window offer, parsed and ready to match against cart lines. */
export async function getActiveOffers(): Promise<ActiveOffer[]> {
  const now = new Date().toISOString().slice(0, 10);
  const offers = await query<RowDataPacket[]>(
    `SELECT id, title, applicability, applicable_ids, discount_type, discount_value, max_discount_amount
     FROM offers
     WHERE is_active = 1
       AND (start_date IS NULL OR start_date <= ?)
       AND (end_date IS NULL OR end_date >= ?)`,
    [now, now]
  );
  return offers.map((o) => ({
    id: o.id as string,
    title: o.title as string,
    applicability: o.applicability as OfferApplicability,
    applicable_ids: typeof o.applicable_ids === "string" ? JSON.parse(o.applicable_ids) : o.applicable_ids || [],
    discount_type: o.discount_type as DiscountType,
    discount_value: Number(o.discount_value),
    max_discount_amount: o.max_discount_amount != null ? Number(o.max_discount_amount) : null,
  }));
}

/**
 * Per cart line, apply whichever active offer yields the largest discount on
 * that line (never stacked — one offer per line, the best one). Shared by
 * /api/offers/apply (cart preview) and /api/orders (authoritative re-check at
 * order-creation time) so the two can never compute a different number for
 * the same cart.
 */
export function bestOfferPerLine(
  items: PromoCartItem[],
  offers: ActiveOffer[],
  ctx: PromoContext
): { totalDiscount: number; lines: { index: number; discount: number; offerId: string | null }[]; appliedOfferIds: string[] } {
  const appliedOffers = new Map<string, number>();
  const lines = items.map((item, idx) => {
    const lineBase = item.price * item.quantity;
    let bestDiscount = 0;
    let bestOfferId: string | null = null;

    for (const offer of offers) {
      if (offer.discount_value <= 0) continue;
      if (!itemMatchesApplicability(item, offer.applicability, offer.applicable_ids, ctx)) continue;
      const d = computeDiscount(lineBase, offer.discount_type, offer.discount_value, offer.max_discount_amount);
      if (d > bestDiscount) { bestDiscount = d; bestOfferId = offer.id; }
    }

    if (bestOfferId && bestDiscount > 0) {
      appliedOffers.set(bestOfferId, (appliedOffers.get(bestOfferId) || 0) + bestDiscount);
    }

    return { index: idx, discount: bestDiscount, offerId: bestOfferId };
  });

  return {
    totalDiscount: lines.reduce((sum, l) => sum + l.discount, 0),
    lines,
    appliedOfferIds: [...appliedOffers.keys()],
  };
}

export interface CouponValidationResult {
  valid: boolean;
  discount: number;
  message: string;
  discount_type?: DiscountType;
  discount_value?: number;
  max_discount_amount?: number | null;
  applicability?: OfferApplicability;
}

/**
 * Validate a coupon code against a cart + customer, and compute the discount
 * it yields — the single authoritative implementation shared by
 * /api/coupons/validate (cart preview) and /api/orders (re-checked at
 * order-creation time so a client can never just send an arbitrary discount).
 */
export async function validateCoupon(
  code: string,
  customerId: string | null,
  items: { product_id: string; variant_id?: string | null; price: number; quantity: number }[],
  orderTotalHint?: number
): Promise<CouponValidationResult> {
  const fail = (message: string): CouponValidationResult => ({ valid: false, discount: 0, message });
  if (!code) return fail("Enter a coupon code");

  const rows = await query<CouponRow[]>("SELECT * FROM coupons WHERE code = ? AND is_active = 1 LIMIT 1", [code]);
  if (rows.length === 0) return fail("Invalid coupon code");
  const coupon = rows[0];
  const now = new Date();

  if (coupon.valid_from && new Date(coupon.valid_from) > now) return fail("This coupon is not active yet");
  if (coupon.valid_until && new Date(coupon.valid_until) < now) return fail("Coupon has expired");
  if (coupon.usage_limit != null && Number(coupon.used_count) >= Number(coupon.usage_limit)) {
    return fail("Coupon usage limit reached");
  }
  // Coupons are a signed-in perk — guests can't redeem any coupon.
  if (!customerId) return fail("Please sign in to use a coupon");

  const applicability = (coupon.applicability || "store") as OfferApplicability;
  const applicableIds: string[] =
    typeof coupon.applicable_ids === "string" ? JSON.parse(coupon.applicable_ids) : coupon.applicable_ids || [];

  const tier = await getCustomerTier(customerId);
  const ctx: PromoContext = { customerId, tierName: tier?.name ?? null, tierId: tier?.id ?? null };

  if (applicability === "customers" && !applicableIds.includes(customerId)) {
    return fail("This coupon is not available for your account");
  }
  if (
    applicability === "tiers" &&
    !(ctx.tierId && applicableIds.includes(ctx.tierId)) &&
    !(ctx.tierName && applicableIds.includes(ctx.tierName))
  ) {
    return fail("This coupon is only for specific membership tiers");
  }

  if (coupon.per_customer_limit != null && Number(coupon.per_customer_limit) > 0) {
    const usedRows = await query<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM orders WHERE customer_id = ? AND coupon_code = ? AND status <> 'cancelled'",
      [customerId, coupon.code]
    );
    if ((Number(usedRows[0]?.cnt) || 0) >= Number(coupon.per_customer_limit)) {
      return fail("You have already used this coupon the maximum number of times");
    }
  }

  let eligibleBase: number;
  if (items.length > 0 && (applicability === "categories" || applicability === "subcategories" || applicability === "products" || applicability === "brands")) {
    const enriched = await enrichCartItems(items);
    eligibleBase = enriched
      .filter((i) => itemMatchesApplicability(i, applicability, applicableIds, ctx))
      .reduce((sum, i) => sum + i.price * i.quantity, 0);
    if (eligibleBase <= 0) return fail("This coupon does not apply to items in your cart");
  } else {
    eligibleBase = orderTotalHint ?? items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  const orderTotal = orderTotalHint ?? eligibleBase;
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

  return {
    valid: true,
    discount,
    message: `Coupon applied! You save ৳${discount.toLocaleString("en-BD")}`,
    discount_type: coupon.discount_type,
    discount_value: Number(coupon.discount_value),
    max_discount_amount: coupon.max_discount_amount != null ? Number(coupon.max_discount_amount) : null,
    applicability,
  };
}
