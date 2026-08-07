import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { ensureCartTable } from "@/lib/migrate-cart";
import { publicServerError } from "@/lib/validate";
import { getVerifiedCustomerId } from "@/lib/customer-session";
import { getVerifiedAdminId } from "@/lib/admin-session";

// Resolve the customer id this request may act on. The id must come from the
// signed session cookie, OR the caller must be an admin (who may name any id).
// A client-supplied id is never trusted on its own — a signed-in customer that
// names a DIFFERENT id is an IDOR attempt and is rejected. Guests have no
// server cart, so they get 401.
function scopeCustomerId(req: NextRequest, clientId: string | null | undefined):
  { id: string } | { error: NextResponse } {
  const sessionId = getVerifiedCustomerId(req);
  const isAdmin = !!getVerifiedAdminId(req);
  const scopedId = isAdmin ? String(clientId || "") : sessionId;
  if (!scopedId) return { error: json({ error: "Not authorized" }, 401) };
  if (!isAdmin && clientId && String(clientId) !== sessionId) {
    return { error: json({ error: "Not authorized" }, 403) };
  }
  return { id: scopedId };
}

// Account-scoped cart persistence for LOGGED-IN customers, so a cart follows
// them across devices and survives logout (localStorage is cleared on logout;
// this brings the cart back on next login). Never cached — per-customer data.
export const dynamic = "force-dynamic";

// Explicit no-store on every response. Cloudflare already bypasses /api via a
// cache rule, but this guarantees no edge/browser/CDN layer ever stores a
// customer's cart regardless of rule config.
const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE });

// GET /api/cart?customer_id=xxx — the customer's saved cart (items + coupon).
export async function GET(req: NextRequest) {
  try {
    await ensureCartTable();
    const scoped = scopeCustomerId(req, req.nextUrl.searchParams.get("customer_id"));
    if ("error" in scoped) return scoped.error;
    const customerId = scoped.id;
    const rows = await query<RowDataPacket[]>(
      "SELECT items, coupon_code FROM customer_carts WHERE customer_id = ? LIMIT 1",
      [customerId]
    );
    // has_saved distinguishes "this customer has NEVER saved a cart" (no row —
    // treat a local guest cart as authoritative) from "saved an EMPTY cart"
    // (row exists with []  — an intentional clear that must stick across devices,
    // never be resurrected from a stale local copy).
    if (rows.length === 0) return json({ items: [], coupon_code: null, has_saved: false });
    // items is stored as JSON; mysql2 may return it already-parsed or as a string.
    let items = rows[0].items;
    if (typeof items === "string") {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    return json({ items: Array.isArray(items) ? items : [], coupon_code: rows[0].coupon_code ?? null, has_saved: true });
  } catch (error: unknown) {
    return publicServerError("GET /api/cart", error);
  }
}

// PUT /api/cart — { customer_id, items, coupon_code? } replace the saved cart.
// Whole-cart upsert (the client is the source of truth while shopping); one row
// per customer. Saving an empty items array clears the server cart.
export async function PUT(req: NextRequest) {
  try {
    await ensureCartTable();
    const body = await req.json();
    const scoped = scopeCustomerId(req, body.customer_id as string | undefined);
    if ("error" in scoped) return scoped.error;
    const customerId = scoped.id;
    const items = Array.isArray(body.items) ? body.items : [];
    const couponCode = typeof body.coupon_code === "string" ? body.coupon_code : null;
    await execute(
      `INSERT INTO customer_carts (customer_id, items, coupon_code)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE items = VALUES(items), coupon_code = VALUES(coupon_code)`,
      [customerId, JSON.stringify(items), couponCode]
    );
    return json({ success: true });
  } catch (error: unknown) {
    return publicServerError("PUT /api/cart", error);
  }
}

// DELETE /api/cart?customer_id=xxx — drop the saved cart entirely.
export async function DELETE(req: NextRequest) {
  try {
    await ensureCartTable();
    const scoped = scopeCustomerId(req, req.nextUrl.searchParams.get("customer_id"));
    if ("error" in scoped) return scoped.error;
    const customerId = scoped.id;
    await execute("DELETE FROM customer_carts WHERE customer_id = ?", [customerId]);
    return json({ success: true });
  } catch (error: unknown) {
    return publicServerError("DELETE /api/cart", error);
  }
}
