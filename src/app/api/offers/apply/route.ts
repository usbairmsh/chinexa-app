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

interface OfferRow extends RowDataPacket {
  id: string;
  title: string;
  applicability: OfferApplicability;
  applicable_ids: string | string[] | null;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount: number | null;
}

interface ApplyItem {
  product_id: string;
  variant_id?: string | null;
  price: number;
  quantity: number;
}

/**
 * POST /api/offers/apply
 * Body: { items: [{ product_id, variant_id?, price, quantity }], customer_id? }
 * Returns the best offer discount per cart line plus a total, evaluated
 * server-side so it can't be tampered with.
 */
export async function POST(req: NextRequest) {
  try {
    await ensurePromotionColumns();
    const body = await req.json();
    const rawItems: ApplyItem[] = Array.isArray(body.items) ? body.items : [];
    const customerId: string | null = body.customer_id || null;

    // Offers are a signed-in perk — guests get no auto-discount at all.
    if (rawItems.length === 0 || !customerId) {
      return NextResponse.json({ total_discount: 0, lines: [], offers: [] });
    }

    const items = await enrichCartItems(rawItems);

    // Active, in-window offers only
    const now = new Date().toISOString().slice(0, 10);
    const offers = await query<OfferRow[]>(
      `SELECT id, title, applicability, applicable_ids, discount_type, discount_value, max_discount_amount
       FROM offers
       WHERE is_active = 1
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)`,
      [now, now]
    );

    const tier = customerId ? await getCustomerTier(customerId) : null;
    const ctx: PromoContext = {
      customerId,
      tierName: tier?.name ?? null,
      tierId: tier?.id ?? null,
    };

    const parsedOffers = offers.map((o) => ({
      id: o.id,
      title: o.title,
      applicability: o.applicability,
      applicable_ids: typeof o.applicable_ids === "string" ? JSON.parse(o.applicable_ids) : o.applicable_ids || [],
      discount_type: o.discount_type,
      discount_value: Number(o.discount_value),
      max_discount_amount: o.max_discount_amount != null ? Number(o.max_discount_amount) : null,
    }));

    const appliedOffers = new Map<string, { id: string; title: string; discount: number }>();
    const lines = items.map((item, idx) => {
      const lineBase = item.price * item.quantity;
      let bestDiscount = 0;
      let bestOffer: { id: string; title: string } | null = null;

      for (const offer of parsedOffers) {
        if (offer.discount_value <= 0) continue;
        if (!itemMatchesApplicability(item, offer.applicability, offer.applicable_ids, ctx)) continue;
        const d = computeDiscount(lineBase, offer.discount_type, offer.discount_value, offer.max_discount_amount);
        if (d > bestDiscount) {
          bestDiscount = d;
          bestOffer = { id: offer.id, title: offer.title };
        }
      }

      if (bestOffer && bestDiscount > 0) {
        const prev = appliedOffers.get(bestOffer.id);
        appliedOffers.set(bestOffer.id, {
          id: bestOffer.id,
          title: bestOffer.title,
          discount: (prev?.discount || 0) + bestDiscount,
        });
      }

      return {
        index: idx,
        product_id: item.product_id,
        variant_id: item.variant_id ?? null,
        discount: bestDiscount,
        offer_id: bestOffer?.id || null,
        offer_title: bestOffer?.title || null,
      };
    });

    const total_discount = lines.reduce((sum, l) => sum + l.discount, 0);

    return NextResponse.json({
      total_discount,
      lines,
      offers: [...appliedOffers.values()],
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
