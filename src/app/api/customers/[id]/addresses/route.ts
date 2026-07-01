import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/customers/[id]/addresses
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC",
      [id]
    );
    return NextResponse.json(rows.map((r) => ({ ...r, is_default: !!r.is_default })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// POST /api/customers/[id]/addresses — create new address
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: customerId } = await params;
    const body = await req.json();
    const addrId = `addr-${Date.now()}`;

    // If this is the first address or marked as default, unset existing defaults
    if (body.is_default) {
      await execute("UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = ?", [customerId]);
    }

    await execute(
      "INSERT INTO customer_addresses (id, customer_id, label, name, phone, address_line_1, address_line_2, city, district, division, postal_code, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        addrId, customerId,
        body.label || "Home",
        body.name || "",
        body.phone || "",
        body.address_line_1 || "",
        body.address_line_2 || null,
        body.city || null,
        body.district || null,
        body.division || null,
        body.postal_code || null,
        body.is_default ? 1 : 0,
      ]
    );
    return NextResponse.json({ success: true, id: addrId }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
