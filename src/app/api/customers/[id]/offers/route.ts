import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { getCustomerTier, resolveApplicableNames } from "@/lib/promotions";
import type { OfferApplicability } from "@/types/offer";

export const dynamic = "force-dynamic";

// GET /api/customers/[id]/offers — active offers this customer currently
// qualifies for: store-wide, their membership tier, or targeted at them
// directly. Offers have no per-customer "assignment" wallet (unlike coupons)
// — qualification is evaluated live from applicability + applicable_ids.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tier = await getCustomerTier(id);

    const now = new Date().toISOString().slice(0, 10);
    const rows = await query<RowDataPacket[]>(
      `SELECT * FROM offers
       WHERE is_active = 1
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)
       ORDER BY created_at DESC`,
      [now, now]
    );

    const offers = await Promise.all(
      rows
        .filter((r) => {
          const applicability = r.applicability as OfferApplicability;
          if (applicability === "store") return true;
          const ids: string[] = typeof r.applicable_ids === "string" ? JSON.parse(r.applicable_ids) : (r.applicable_ids as string[]) || [];
          if (applicability === "customers") return ids.includes(id);
          if (applicability === "tiers") return !!tier && (ids.includes(tier.id) || ids.includes(tier.name));
          // Category/subcategory/product-scoped offers apply at checkout to
          // matching line items, not the whole order — still worth surfacing
          // here so customers know they exist.
          return true;
        })
        .map(async (r) => {
          const applicable_ids: string[] = typeof r.applicable_ids === "string" ? JSON.parse(r.applicable_ids) : (r.applicable_ids as string[]) || [];
          return {
            ...r,
            is_active: !!r.is_active,
            discount_value: r.discount_value != null ? Number(r.discount_value) : 0,
            max_discount_amount: r.max_discount_amount != null ? Number(r.max_discount_amount) : null,
            usage_count: Number(r.usage_count) || 0,
            applicable_ids,
            applicable_names: await resolveApplicableNames(r.applicability as OfferApplicability, applicable_ids),
          };
        })
    );

    return NextResponse.json(offers);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
