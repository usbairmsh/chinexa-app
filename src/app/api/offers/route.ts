import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError } from "@/lib/validate";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";

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
    return NextResponse.json(rows.map((r) => ({
      ...r,
      is_active: !!r.is_active,
      discount_value: r.discount_value != null ? Number(r.discount_value) : 0,
      max_discount_amount: r.max_discount_amount != null ? Number(r.max_discount_amount) : null,
      applicable_ids: typeof r.applicable_ids === "string" ? JSON.parse(r.applicable_ids) : r.applicable_ids || [],
    })));
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
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
