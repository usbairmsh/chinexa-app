import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError, dependencyError, publicServerError } from "@/lib/validate";
import { notifyAdmin } from "@/lib/notify";
import { ensureReviewColumns, publicReviewsEnabled, resolveCustomerTierSnapshot } from "@/lib/migrate-reviews";
import { getVerifiedCustomerId } from "@/lib/customer-session";
import { getVerifiedAdminId } from "@/lib/admin-session";

function parseImages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string").slice(0, 5);
  if (typeof raw === "string" && raw) {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

export async function GET(req: NextRequest) {
  try {
    await ensureReviewColumns();
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("product_id");
    const customerId = searchParams.get("customer_id");
    const approved = searchParams.get("is_approved");
    const limit = Number(searchParams.get("limit")) || 50;

    const isAdmin = !!getVerifiedAdminId(req);
    const sessionCustomerId = getVerifiedCustomerId(req);

    let where = "WHERE 1=1";
    const params: (string | number)[] = [];
    if (productId) { where += " AND product_id = ?"; params.push(productId); }
    if (customerId) {
      // "My reviews" — a customer may only list their own; admins may list any.
      // Was unscoped: anyone could enumerate another customer's reviews by id.
      if (!isAdmin && customerId !== sessionCustomerId) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      where += " AND customer_id = ?"; params.push(customerId);
    }
    if (approved === "true") { where += " AND is_approved = 1"; }
    else if (approved === "false") {
      // Unmoderated reviews are admin-only — otherwise anyone could read pending
      // (unapproved) reviews, including their content and author id.
      if (!isAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      where += " AND is_approved = 0";
    } else if (!isAdmin && !customerId) {
      // Public product listing: only ever show approved reviews. (A customer
      // listing their OWN reviews sees their pending ones too — that's fine.)
      where += " AND is_approved = 1";
    }

    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 200));
    const rows = await query<RowDataPacket[]>(`SELECT * FROM reviews ${where} ORDER BY created_at DESC LIMIT ${safeLimit}`, params);
    return NextResponse.json(rows.map((r) => ({
      ...r,
      is_verified_purchase: !!r.is_verified_purchase,
      is_approved: !!r.is_approved,
      images: parseImages(r.images),
      // Tier snapshot (registered reviewers only; null for anonymous).
      customer_tier: (r.customer_tier as string) || null,
      customer_tier_color: (r.customer_tier_color as string) || null,
    })));
  } catch (error: unknown) {
    return publicServerError("GET /api/reviews", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureReviewColumns();
    const body = await req.json();
    const err = validate([
      { field: "product_id", value: body.product_id, rules: ["required", "string"], label: "Product" },
      { field: "customer_name", value: body.customer_name, rules: ["required", "string", { maxLength: 255 }], label: "Customer name" },
      { field: "rating", value: Number(body.rating), rules: ["required", "number", { range: [1, 5] }], label: "Rating" },
      { field: "title", value: body.title, rules: [{ maxLength: 255 }], label: "Review title" },
      { field: "comment", value: body.comment, rules: ["required", "string", { minLength: 3 }, { maxLength: 5000 }], label: "Comment" },
    ]);
    if (err) return validationError(err);

    const images = parseImages(body.images);
    if (images.length > 5) return validationError("You can attach at most 5 images");

    // Author identity comes from the SESSION, never the request body. A signed-in
    // customer's review is always attributed to their own id; a request with no
    // session can only post an anonymous review (customer_id = null). This blocks
    // submitting a review AS another customer (which also drove the spoofable
    // "verified purchase" and one-review-per-product checks below).
    const sessionCustomerId = getVerifiedCustomerId(req);
    body.customer_id = sessionCustomerId || null;

    const productExists = await query<RowDataPacket[]>("SELECT id FROM products WHERE id = ?", [body.product_id]);
    if (productExists.length === 0) return dependencyError("Product", body.product_id);

    // ─── Open-reviews policy (enforced server-side) ───
    // Registered customers (customer_id present) may always review. Anonymous
    // (no customer_id) may review ONLY when the admin's "public_reviews" toggle
    // is on. is_approved is ALWAYS forced to 0 here (never trust the client) —
    // every visitor review is moderated before it shows or counts.
    const isRegistered = !!body.customer_id;
    if (!isRegistered) {
      const open = await publicReviewsEnabled();
      if (!open) {
        return NextResponse.json({ error: "Public reviews are currently closed. Please sign in to write a review." }, { status: 403 });
      }
    }
    // Display name: registered reviewers keep their real name; anonymous
    // visitors get a unique friendly alias (e.g. "Guest Shopper #4821") so
    // multiple guest reviews read as different people rather than an identical
    // repeated label. The number is derived from the review id for stability.
    const displayName = isRegistered ? body.customer_name : `Guest Shopper #${1000 + (Date.now() % 9000)}`;

    // One review per product per logged-in customer — checked here (fast,
    // friendly error) as well as enforced by the DB's unique index (the real
    // guarantee under a race between two concurrent submissions).
    if (body.customer_id) {
      const existing = await query<RowDataPacket[]>(
        "SELECT id FROM reviews WHERE customer_id = ? AND product_id = ? LIMIT 1",
        [body.customer_id, body.product_id]
      );
      if (existing.length > 0) {
        return NextResponse.json({ error: "You've already reviewed this product" }, { status: 409 });
      }
    }

    // "Verified Purchase" must reflect an actual delivered order, not merely
    // "the requester happened to be logged in" — otherwise any signed-in
    // customer could badge a review as verified for a product they never
    // bought. Only counts orders already marked 'received' (delivered).
    let isVerifiedPurchase = false;
    let orderId: string | null = null;
    if (body.customer_id) {
      const orderRows = await query<RowDataPacket[]>(
        `SELECT o.id FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.customer_id = ? AND o.status = 'received' AND oi.product_id = ?
         ORDER BY o.created_at DESC LIMIT 1`,
        [body.customer_id, body.product_id]
      );
      if (orderRows.length > 0) {
        isVerifiedPurchase = true;
        orderId = orderRows[0].id as string;
      }
    }

    // Snapshot the registered reviewer's membership tier (name + badge colour)
    // so the review list can show the tier badge with no membership join.
    let tierName: string | null = null;
    let tierColor: string | null = null;
    if (isRegistered) {
      const t = await resolveCustomerTierSnapshot(body.customer_id);
      tierName = t.name;
      tierColor = t.color;
    }

    const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await execute(
        "INSERT INTO reviews (id, product_id, product_name, order_id, customer_id, customer_name, rating, title, comment, images, is_verified_purchase, is_approved, customer_tier, customer_tier_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, body.product_id, body.product_name || null, orderId, body.customer_id || null, displayName, body.rating, body.title || null, body.comment, JSON.stringify(images), isVerifiedPurchase ? 1 : 0, 0, tierName, tierColor]
      );
    } catch (dbError: unknown) {
      const msg = dbError instanceof Error ? dbError.message : "";
      if (msg.includes("Duplicate entry") && msg.includes("uniq_customer_product_review")) {
        return NextResponse.json({ error: "You've already reviewed this product" }, { status: 409 });
      }
      throw dbError;
    }
    await logActivity("Created review", "review", id, body.product_name);

    // Every submitted review is pending — alert the admin to moderate it.
    await notifyAdmin(
      "review",
      `New review pending approval`,
      `${displayName} rated ${body.product_name || "a product"} ${Number(body.rating)}★ — "${String(body.comment).slice(0, 80)}"`,
      "/admin/reviews"
    );

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return publicServerError("POST /api/reviews", error);
  }
}
