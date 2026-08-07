import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { validationError, publicServerError } from "@/lib/validate";
import { getVerifiedCustomerId } from "@/lib/customer-session";
import { getVerifiedAdminId } from "@/lib/admin-session";

// Owner-or-admin: the [id] path param is the customer. Only the session owner
// or an admin may act; a signed-in customer naming another id is rejected.
function authorizeOwnerOrAdmin(req: NextRequest, pathId: string): NextResponse | null {
  if (getVerifiedAdminId(req)) return null;
  const sessionId = getVerifiedCustomerId(req);
  if (!sessionId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (sessionId !== pathId) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  return null;
}

// PUT /api/customers/[id]/addresses/[addressId]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; addressId: string }> }) {
  try {
    const { id: customerId, addressId } = await params;
    const denied = authorizeOwnerOrAdmin(req, customerId);
    if (denied) return denied;
    const body = await req.json();

    // Same required/format rules as POST — only checked when the field is
    // actually part of this update, since this route also allows a
    // single-field patch (e.g. just toggling is_default).
    if (body.name !== undefined && !String(body.name).trim()) return validationError("Recipient name is required");
    if (body.phone !== undefined && !String(body.phone).trim()) return validationError("Phone number is required");
    if (body.address_line_1 !== undefined && !String(body.address_line_1).trim()) return validationError("Address is required");
    if (body.postal_code && !/^\d{4}$/.test(String(body.postal_code).trim())) {
      return validationError("Postal code must be a 4-digit number");
    }

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
      // Scope to the customer so an address can't be edited across accounts.
      values.push(addressId, customerId);
      await execute(`UPDATE customer_addresses SET ${fields.join(", ")} WHERE id = ? AND customer_id = ?`, values);
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return publicServerError("PUT /api/customers/[id]/addresses/[addressId]", error);
  }
}

// DELETE /api/customers/[id]/addresses/[addressId]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; addressId: string }> }) {
  try {
    const { id: customerId, addressId } = await params;
    const denied = authorizeOwnerOrAdmin(req, customerId);
    if (denied) return denied;
    // Scope to the customer so an address can't be deleted across accounts.
    await execute("DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?", [addressId, customerId]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return publicServerError("DELETE /api/customers/[id]/addresses/[addressId]", error);
  }
}
