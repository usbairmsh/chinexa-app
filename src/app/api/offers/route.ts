import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";

interface OfferRow extends RowDataPacket { [key: string]: unknown; }

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query<OfferRow[]>("SELECT * FROM offers ORDER BY created_at DESC");
    return NextResponse.json(rows.map((r) => ({ ...r, is_active: !!r.is_active })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = `offer-${Date.now()}`;
    await execute(
      "INSERT INTO offers (id, title, description, type, category, discount, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, body.title, body.description || null, body.type || "seasonal", body.category || null, body.discount, body.start_date || null, body.end_date || null, body.is_active !== false ? 1 : 0]
    );
    await logActivity("Created offer", "banner", id, body.title);
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
