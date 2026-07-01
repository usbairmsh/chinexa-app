import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";

// PUT /api/customers/[id]/addresses/[addressId]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; addressId: string }> }) {
  try {
    const { id: customerId, addressId } = await params;
    const body = await req.json();

    // Handle "set as default"
    if (body.is_default) {
      await execute("UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = ?", [customerId]);
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const [k, col] of Object.entries({
      label: "label", name: "name", phone: "phone",
      address_line_1: "address_line_1", address_line_2: "address_line_2",
      city: "city", district: "district", division: "division", postal_code: "postal_code",
    })) {
      if (body[k] !== undefined) { fields.push(`${col} = ?`); values.push(body[k]); }
    }
    if (body.is_default !== undefined) { fields.push("is_default = ?"); values.push(body.is_default ? 1 : 0); }

    if (fields.length > 0) {
      values.push(addressId);
      await execute(`UPDATE customer_addresses SET ${fields.join(", ")} WHERE id = ?`, values);
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// DELETE /api/customers/[id]/addresses/[addressId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ addressId: string }> }) {
  try {
    const { addressId } = await params;
    await execute("DELETE FROM customer_addresses WHERE id = ?", [addressId]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
