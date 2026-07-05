import { query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import type { OfferApplicability, DiscountType } from "@/types/offer";

export interface PromoCartItem {
  product_id: string;
  variant_id?: string | null;
  price: number;
  quantity: number;
  category_id?: string | null;
  subcategory?: string | null;
}

export interface PromoContext {
  customerId?: string | null;
  tierName?: string | null;
}

/** Look up a customer's current membership tier from their points balance. */
export async function getCustomerTier(customerId: string): Promise<string | null> {
  const balanceRows = await query<RowDataPacket[]>(
    "SELECT COALESCE(SUM(points), 0) as total_points FROM customer_points WHERE customer_id = ?",
    [customerId]
  );
  const totalPoints = Number(balanceRows[0]?.total_points) || 0;
  const tiers = await query<RowDataPacket[]>(
    "SELECT name FROM membership_tiers WHERE is_active = 1 AND min_points <= ? AND max_points >= ? LIMIT 1",
    [totalPoints, totalPoints]
  );
  return tiers.length > 0 ? (tiers[0].name as string) : null;
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

  const productPlaceholders = productIds.map(() => "?").join(",");
  const productRows = await query<RowDataPacket[]>(
    `SELECT id, category_id, subcategory, price FROM products WHERE id IN (${productPlaceholders})`,
    productIds
  );
  const productById = new Map(productRows.map((r) => [r.id as string, r]));

  // Look up any selected variants so we can apply their price adjustment.
  const variantIds = [...new Set(items.map((i) => i.variant_id).filter((v): v is string => !!v))];
  const adjustmentByVariant = new Map<string, number>();
  if (variantIds.length > 0) {
    const variantPlaceholders = variantIds.map(() => "?").join(",");
    const variantRows = await query<RowDataPacket[]>(
      `SELECT id, price_adjustment FROM product_variants WHERE id IN (${variantPlaceholders})`,
      variantIds
    );
    for (const v of variantRows) {
      adjustmentByVariant.set(v.id as string, Number(v.price_adjustment) || 0);
    }
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
    case "customers":
      // Customer-scoped promos apply to the whole cart, but only for the named customers.
      return !!ctx.customerId && applicableIds.includes(ctx.customerId);
    case "tiers":
      return !!ctx.tierName && applicableIds.includes(ctx.tierName);
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
