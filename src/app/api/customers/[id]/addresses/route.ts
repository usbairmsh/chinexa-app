import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { validate, validationError, publicServerError } from "@/lib/validate";

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
    return publicServerError("GET /api/customers/[id]/addresses", error);
  }
}

// POST /api/customers/[id]/addresses — create new address
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: customerId } = await params;
    const body = await req.json();

    // Previously every field defaulted to "" / null with no check at all — a
    // direct call (or a client bug) could save a fully blank address that
    // would later silently autofill a real checkout. Required fields mirror
    // exactly what the account address form itself requires (name +
    // address_line_1 — see (account)/dashboard/addresses/page.tsx's own
    // handleSave guard) plus phone, since a delivery address with no phone
    // isn't useful; city/district/division/postal_code stay optional but are
    // still format/length-checked if the caller does provide them.
    const err = validate([
      { field: "name", value: body.name, rules: ["required", "string", { maxLength: 100 }], label: "Recipient name" },
      { field: "phone", value: body.phone, rules: ["required", "string", "phone"], label: "Phone number" },
      { field: "address_line_1", value: body.address_line_1, rules: ["required", "string", { maxLength: 255 }], label: "Address" },
    ]);
    if (err) return validationError(err);
    if (body.city && String(body.city).length > 100) return validationError("City must be at most 100 characters");
    if (body.district && String(body.district).length > 100) return validationError("District must be at most 100 characters");
    if (body.division && String(body.division).length > 100) return validationError("Division must be at most 100 characters");
    if (body.postal_code && !/^\d{4}$/.test(String(body.postal_code).trim())) {
      return validationError("Postal code must be a 4-digit number");
    }

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
    return publicServerError("POST /api/customers/[id]/addresses", error);
  }
}
