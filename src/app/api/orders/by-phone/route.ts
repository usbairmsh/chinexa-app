import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { publicServerError, validationError } from "@/lib/validate";

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, "");
  if (cleaned.startsWith("+880")) return cleaned;
  if (cleaned.startsWith("880")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+880${cleaned.slice(1)}`;
  return cleaned;
}

// GET /api/orders/by-phone?phone=... — public Track Order "search by phone
// alone" path. Returns a lightweight list (no address/PII beyond what the
// customer themselves typed in) of every order placed under that phone
// number, so a guest can pick which one to see full tracking detail for.
// Deliberately scoped to an exact normalized-phone match — never a fuzzy
// LIKE — so this can't be used to browse/enumerate other customers' orders.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone")?.trim();
    if (!phone) return validationError("Phone number is required");

    const normalized = normalizePhone(phone);
    // customer_phone is stored in whatever format the checkout form/admin
    // entered it in — match both the raw input and its normalized form
    // rather than requiring the DB column itself to be pre-normalized.
    const rows = await query<RowDataPacket[]>(
      `SELECT id, order_number, status, total, created_at
       FROM orders
       WHERE customer_phone = ? OR customer_phone = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [phone, normalized]
    );

    return NextResponse.json({
      orders: rows.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total: Number(o.total) || 0,
        created_at: o.created_at,
      })),
    });
  } catch (error: unknown) {
    return publicServerError("GET /api/orders/by-phone", error);
  }
}
