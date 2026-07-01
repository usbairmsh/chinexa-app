import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError } from "@/lib/validate";

interface OfferRow extends RowDataPacket { [key: string]: unknown; }

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query<OfferRow[]>("SELECT * FROM offers ORDER BY created_at DESC");
    return NextResponse.json(rows.map((r) => ({
      ...r,
      is_active: !!r.is_active,
      applicable_ids: typeof r.applicable_ids === "string" ? JSON.parse(r.applicable_ids) : r.applicable_ids || [],
    })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const err = validate([
      { field: "title", value: body.title, rules: ["required", "string"], label: "Offer title" },
      { field: "discount", value: body.discount, rules: ["required", "string"], label: "Discount" },
    ]);
    if (err) return validationError(err);
    if (body.start_date && body.end_date && new Date(body.start_date) >= new Date(body.end_date)) {
      return validationError("Start date must be before end date");
    }
    const id = `offer-${Date.now()}`;
    await execute(
      "INSERT INTO offers (id, title, description, applicability, applicable_ids, discount, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id, body.title, body.description || null,
        body.applicability || "store",
        JSON.stringify(body.applicable_ids || []),
        body.discount,
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
