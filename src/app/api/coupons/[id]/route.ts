import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const fields: string[] = []; const values: (string | number | null)[] = [];
    for (const [k, col] of Object.entries({ code: "code", description: "description", discount_type: "discount_type", discount_value: "discount_value", min_order_amount: "min_order_amount", max_discount_amount: "max_discount_amount", usage_limit: "usage_limit" })) {
      if (body[k] !== undefined) { fields.push(`${col} = ?`); values.push(body[k]); }
    }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (body.valid_from !== undefined) { fields.push("valid_from = ?"); values.push(body.valid_from); }
    if (body.valid_until !== undefined) { fields.push("valid_until = ?"); values.push(body.valid_until); }
    if (fields.length > 0) { values.push(id); await execute(`UPDATE coupons SET ${fields.join(", ")} WHERE id = ?`, values); }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; await execute("DELETE FROM coupons WHERE id = ?", [id]); return NextResponse.json({ success: true }); }
  catch (error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 }); }
}
