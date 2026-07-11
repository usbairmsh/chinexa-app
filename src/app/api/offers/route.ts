import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError } from "@/lib/validate";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { resolveApplicableNames } from "@/lib/promotions";
import { bulkNotify, resolvePromoRecipients } from "@/lib/notify";
import type { OfferApplicability } from "@/types/offer";

interface OfferRow extends RowDataPacket { [key: string]: unknown; }

export const dynamic = "force-dynamic";

/** Human-readable label for the discount, e.g. "30% OFF" or "৳500 OFF". */
function discountLabel(type: string, value: number): string {
  return type === "fixed" ? `৳${value} OFF` : `${value}% OFF`;
}

export async function GET() {
  try {
    await ensurePromotionColumns();
    const rows = await query<OfferRow[]>("SELECT * FROM offers ORDER BY created_at DESC");
    const offers = await Promise.all(rows.map(async (r) => {
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
    }));
    return NextResponse.json(offers);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensurePromotionColumns();
    const body = await req.json();
    const err = validate([
      { field: "title", value: body.title, rules: ["required", "string"], label: "Offer title" },
    ]);
    if (err) return validationError(err);

    const discountType = body.discount_type === "fixed" ? "fixed" : "percentage";
    const discountValue = Number(body.discount_value);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return validationError("Discount value must be a positive number");
    }
    if (discountType === "percentage" && discountValue > 100) {
      return validationError("Percentage discount cannot exceed 100%");
    }
    if (body.start_date && body.end_date && new Date(body.start_date) >= new Date(body.end_date)) {
      return validationError("Start date must be before end date");
    }
    // A scoped offer with no ids in scope applies to nothing — this is
    // almost always a mistake (the admin picked a scope but forgot to
    // actually select which products/categories/etc it targets), not an
    // intentional "affects nobody" offer.
    const scopedApplicability = ["products", "categories", "subcategories", "brands", "customers", "tiers"];
    if (scopedApplicability.includes(body.applicability) && (!Array.isArray(body.applicable_ids) || body.applicable_ids.length === 0)) {
      return validationError(`Select at least one ${body.applicability === "customers" ? "customer" : body.applicability === "tiers" ? "tier" : body.applicability.replace(/s$/, "")} for this offer to apply to`);
    }

    const id = `offer-${Date.now()}`;
    const label = body.discount || discountLabel(discountType, discountValue);
    await execute(
      "INSERT INTO offers (id, title, description, applicability, applicable_ids, discount, discount_type, discount_value, max_discount_amount, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id, body.title, body.description || null,
        body.applicability || "store",
        JSON.stringify(body.applicable_ids || []),
        label, discountType, discountValue,
        body.max_discount_amount != null && body.max_discount_amount !== "" ? Number(body.max_discount_amount) : null,
        body.start_date || null, body.end_date || null,
        body.is_active !== false ? 1 : 0,
      ]
    );
    await logActivity("Created offer", "offer", id, body.title);

    // Auto-notify applicable customers about the new offer (non-blocking)
    if (body.is_active !== false) {
      try {
        const recipients = await resolvePromoRecipients(body.applicability || "store", body.applicable_ids || []);
        await bulkNotify(recipients, {
          type: "promo",
          title: `New Offer: ${body.title}`,
          message: `${label}${body.description ? ` — ${body.description}` : ""}. Shop now and save!`,
          link: "/products",
        });
      } catch (err) {
        console.error("[offers] notify failed:", err);
      }
    }

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
