import { NextRequest, NextResponse } from "next/server";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import {
  enrichCartItems,
  getCustomerTier,
  getActiveOffers,
  bestOfferPerLine,
  type PromoContext,
} from "@/lib/promotions";
import { publicServerError } from "@/lib/validate";

export const dynamic = "force-dynamic";

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
 * server-side so it can't be tampered with. Shares its matching logic with
 * /api/orders' authoritative re-check at order-creation time via
 * bestOfferPerLine() in src/lib/promotions.ts.
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

    const [items, offers, tier] = await Promise.all([
      enrichCartItems(rawItems),
      getActiveOffers(),
      getCustomerTier(customerId),
    ]);
    const ctx: PromoContext = {
      customerId,
      tierName: tier?.name ?? null,
      tierId: tier?.id ?? null,
    };

    const { totalDiscount, lines, appliedOfferIds } = bestOfferPerLine(items, offers, ctx);
    const offersById = new Map(offers.map((o) => [o.id, o]));

    return NextResponse.json({
      total_discount: totalDiscount,
      lines: lines.map((l) => ({
        index: l.index,
        product_id: items[l.index].product_id,
        variant_id: items[l.index].variant_id ?? null,
        discount: l.discount,
        offer_id: l.offerId,
        offer_title: l.offerId ? offersById.get(l.offerId)?.title || null : null,
      })),
      offers: appliedOfferIds.map((id) => ({
        id,
        title: offersById.get(id)?.title || "",
        discount: lines.filter((l) => l.offerId === id).reduce((sum, l) => sum + l.discount, 0),
      })),
    });
  } catch (error: unknown) {
    return publicServerError("POST /api/offers/apply", error);
  }
}
