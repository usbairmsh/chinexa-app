import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("product_id");
    const approved = searchParams.get("is_approved");
    const limit = Number(searchParams.get("limit")) || 50;

    let where = "WHERE 1=1";
    const params: (string | number)[] = [];
    if (productId) { where += " AND product_id = ?"; params.push(productId); }
    if (approved === "true") { where += " AND is_approved = 1"; }
    if (approved === "false") { where += " AND is_approved = 0"; }

    const rows = await query<RowDataPacket[]>(`SELECT * FROM reviews ${where} ORDER BY created_at DESC LIMIT ?`, [...params, limit]);
    return NextResponse.json(rows.map((r) => ({ ...r, is_verified_purchase: !!r.is_verified_purchase, is_approved: !!r.is_approved })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = `rev-${Date.now()}`;
    await execute(
      "INSERT INTO reviews (id, product_id, product_name, customer_id, customer_name, rating, title, comment, is_verified_purchase, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, body.product_id, body.product_name || null, body.customer_id || null, body.customer_name, body.rating, body.title || null, body.comment, body.is_verified_purchase ? 1 : 0, body.is_approved ? 1 : 0]
    );
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
