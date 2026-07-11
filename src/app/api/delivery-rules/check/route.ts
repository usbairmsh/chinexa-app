import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { enrichCartItems, getCustomerTier, itemMatchesApplicability, type PromoContext } from "@/lib/promotions";
import type { OfferApplicability } from "@/types/offer";
import { publicServerError } from "@/lib/validate";

export const dynamic = "force-dynamic";

interface RuleRow extends RowDataPacket {
  rule_type: "standard" | "express";
  is_active: boolean;
  applicability: OfferApplicability;
  applicable_ids: string | string[] | null;
}

interface CheckItem {
  product_id: string;
  variant_id?: string | null;
  price: number;
  quantity: number;
}

/**
 * POST /api/delivery-rules/check
 * Body: { items: [{ product_id, variant_id?, price, quantity }], customer_id? }
 * Returns { standard: boolean, express: boolean } — whether this cart/customer
 * qualifies for free standard and/or free express delivery, evaluated
 * server-side using the same applicability model as offers/coupons. A
 * store-wide rule always qualifies; a category/product/brand-scoped rule
 * qualifies if at least one cart line matches (free delivery is an
 * order-level perk, not a per-line discount).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawItems: CheckItem[] = Array.isArray(body.items) ? body.items : [];
    const customerId: string | null = body.customer_id || null;

    const rows = await query<RowDataPacket[]>(
      "SELECT rule_type, is_active, applicability, applicable_ids FROM delivery_rules WHERE is_active = 1"
    ).catch(() => [] as RowDataPacket[]);

    const result = { standard: false, express: false };
    if (rows.length === 0) return NextResponse.json(result);

    // Independent of each other — batched instead of sequential.
    const [tier, items] = await Promise.all([
      customerId ? getCustomerTier(customerId) : Promise.resolve(null),
      rawItems.length > 0 ? enrichCartItems(rawItems) : Promise.resolve([]),
    ]);
    const ctx: PromoContext = { customerId, tierName: tier?.name ?? null, tierId: tier?.id ?? null };

    for (const r of rows as RuleRow[]) {
      const applicability = r.applicability || "store";
      const applicableIds: string[] = typeof r.applicable_ids === "string" ? JSON.parse(r.applicable_ids) : r.applicable_ids || [];

      let qualifies: boolean;
      if (applicability === "store" || applicability === "customers" || applicability === "tiers") {
        qualifies = itemMatchesApplicability({ product_id: "", price: 0, quantity: 0 }, applicability, applicableIds, ctx);
      } else {
        // Category/product/brand-scoped: qualifies if any cart line matches.
        qualifies = items.some((i) => itemMatchesApplicability(i, applicability, applicableIds, ctx));
      }

      if (r.rule_type === "standard") result.standard = qualifies;
      if (r.rule_type === "express") result.express = qualifies;
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    return publicServerError("POST /api/delivery-rules/check", error);
  }
}
