import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { ensureInventoryTables } from "@/lib/migrate-inventory";
import { publicServerError } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Server-side wishlist for LOGGED-IN customers. The storefront wishlist is
// otherwise localStorage-only; this record exists so that when an out-of-stock
// item a customer wishlisted is restocked, we can notify them (see
// notifyBackInStock in migrate-inventory). Only out-of-stock adds set
// notify_on_restock = 1; in-stock adds are still recorded (so the count/state
// is consistent) but don't schedule a notification.

// Per-customer data — must never be cached at any layer (browser, CDN,
// Cloudflare). force-dynamic keeps Next from caching; these explicit headers
// stop the browser HTTP cache and any edge from ever storing/replaying one
// customer's wishlist for another. Mirrors the /api/cart route.
const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE });

// GET /api/wishlist?customer_id=xxx — the customer's server-side wishlist ids
export async function GET(req: NextRequest) {
  try {
    await ensureInventoryTables();
    const customerId = req.nextUrl.searchParams.get("customer_id");
    if (!customerId) return json({ error: "customer_id required" }, 400);
    const rows = await query<RowDataPacket[]>(
      "SELECT product_id, notify_on_restock FROM customer_wishlists WHERE customer_id = ?",
      [customerId]
    );
    // Backwards-compatible: still an array, but with a non-enumerated `has_saved`
    // hint attached so the client can tell "never saved" from "emptied". Older
    // callers that just map the array keep working.
    const items = rows.map((r) => ({ product_id: r.product_id, notify_on_restock: !!r.notify_on_restock }));
    return json({ items, has_saved: rows.length > 0 });
  } catch (error: unknown) {
    return publicServerError("GET /api/wishlist", error);
  }
}

// POST /api/wishlist — { customer_id, product_id } add to server wishlist.
// Returns { out_of_stock: boolean } so the client can show the right popup.
export async function POST(req: NextRequest) {
  try {
    await ensureInventoryTables();
    const body = await req.json();
    const customerId = body.customer_id as string | undefined;
    const productId = body.product_id as string | undefined;
    if (!customerId || !productId) return json({ error: "customer_id and product_id are required" }, 400);

    // Is the product currently out of stock? Only then do we schedule a
    // back-in-stock notification + bump the demand counter.
    const prod = await query<RowDataPacket[]>("SELECT stock_quantity FROM products WHERE id = ? LIMIT 1", [productId]);
    if (prod.length === 0) return json({ error: "Product not found" }, 404);
    const outOfStock = Number(prod[0].stock_quantity) === 0;

    // Was this (customer, product) pair already recording a restock wait?
    // Only bump oos_wishlist_count on a genuinely new out-of-stock add, so a
    // customer toggling the same item can't inflate the demand number.
    const existing = await query<RowDataPacket[]>(
      "SELECT notify_on_restock FROM customer_wishlists WHERE customer_id = ? AND product_id = ? LIMIT 1",
      [customerId, productId]
    );
    const alreadyWaiting = existing.length > 0 && !!existing[0].notify_on_restock;

    const id = `cw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await execute(
      `INSERT INTO customer_wishlists (id, customer_id, product_id, notify_on_restock)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE notify_on_restock = GREATEST(notify_on_restock, VALUES(notify_on_restock))`,
      [id, customerId, productId, outOfStock ? 1 : 0]
    );

    if (outOfStock && !alreadyWaiting) {
      await execute("UPDATE products SET oos_wishlist_count = oos_wishlist_count + 1 WHERE id = ?", [productId]);
    }

    return json({ success: true, out_of_stock: outOfStock });
  } catch (error: unknown) {
    return publicServerError("POST /api/wishlist", error);
  }
}

// DELETE /api/wishlist?customer_id=xxx&product_id=yyy — remove from server wishlist
export async function DELETE(req: NextRequest) {
  try {
    await ensureInventoryTables();
    const customerId = req.nextUrl.searchParams.get("customer_id");
    const productId = req.nextUrl.searchParams.get("product_id");
    if (!customerId || !productId) return json({ error: "customer_id and product_id are required" }, 400);

    // If they were waiting on a restock, decrement the demand counter as they leave.
    const existing = await query<RowDataPacket[]>(
      "SELECT notify_on_restock FROM customer_wishlists WHERE customer_id = ? AND product_id = ? LIMIT 1",
      [customerId, productId]
    );
    const wasWaiting = existing.length > 0 && !!existing[0].notify_on_restock;
    await execute("DELETE FROM customer_wishlists WHERE customer_id = ? AND product_id = ?", [customerId, productId]);
    if (wasWaiting) {
      await execute("UPDATE products SET oos_wishlist_count = GREATEST(oos_wishlist_count - 1, 0) WHERE id = ?", [productId]);
    }
    return json({ success: true });
  } catch (error: unknown) {
    return publicServerError("DELETE /api/wishlist", error);
  }
}
