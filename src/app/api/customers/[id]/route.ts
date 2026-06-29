import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const customers = await query<RowDataPacket[]>("SELECT * FROM customers WHERE id = ? LIMIT 1", [id]);
    if (customers.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const addresses = await query<RowDataPacket[]>("SELECT * FROM customer_addresses WHERE customer_id = ?", [id]);
    const orders = await query<RowDataPacket[]>("SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC", [id]);
    return NextResponse.json({ ...customers[0], is_active: !!customers[0].is_active, addresses, orders });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const fields: string[] = []; const values: (string | number | null)[] = [];
    for (const [k, col] of Object.entries({ name: "name", email: "email", phone: "phone" })) {
      if (body[k] !== undefined) { fields.push(`${col} = ?`); values.push(body[k]); }
    }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (fields.length > 0) { values.push(id); await execute(`UPDATE customers SET ${fields.join(", ")} WHERE id = ?`, values); }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; await execute("DELETE FROM customers WHERE id = ?", [id]); return NextResponse.json({ success: true }); }
  catch (error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 }); }
}
