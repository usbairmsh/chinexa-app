import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError, dependencyError, publicServerError } from "@/lib/validate";
import { notifyAdmin } from "@/lib/notify";
import { ensureReviewColumns } from "@/lib/migrate-reviews";

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

    let where = "WHERE 1=1";
    const params: (string | number)[] = [];
    if (productId) { where += " AND product_id = ?"; params.push(productId); }
    if (customerId) { where += " AND customer_id = ?"; params.push(customerId); }
    if (approved === "true") { where += " AND is_approved = 1"; }
    if (approved === "false") { where += " AND is_approved = 0"; }

    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 200));
    const rows = await query<RowDataPacket[]>(`SELECT * FROM reviews ${where} ORDER BY created_at DESC LIMIT ${safeLimit}`, params);
    return NextResponse.json(rows.map((r) => ({
      ...r,
      is_verified_purchase: !!r.is_verified_purchase,
      is_approved: !!r.is_approved,
      images: parseImages(r.images),
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

    const productExists = await query<RowDataPacket[]>("SELECT id FROM products WHERE id = ?", [body.product_id]);
    if (productExists.length === 0) return dependencyError("Product", body.product_id);

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

    const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await execute(
        "INSERT INTO reviews (id, product_id, product_name, order_id, customer_id, customer_name, rating, title, comment, images, is_verified_purchase, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, body.product_id, body.product_name || null, orderId, body.customer_id || null, body.customer_name, body.rating, body.title || null, body.comment, JSON.stringify(images), isVerifiedPurchase ? 1 : 0, body.is_approved ? 1 : 0]
      );
    } catch (dbError: unknown) {
      const msg = dbError instanceof Error ? dbError.message : "";
      if (msg.includes("Duplicate entry") && msg.includes("uniq_customer_product_review")) {
        return NextResponse.json({ error: "You've already reviewed this product" }, { status: 409 });
      }
      throw dbError;
    }
    await logActivity("Created review", "review", id, body.product_name);

    // Alert admin only for customer-submitted reviews awaiting approval
    if (!body.is_approved) {
      await notifyAdmin(
        "review",
        `New review pending approval`,
        `${body.customer_name} rated ${body.product_name || "a product"} ${Number(body.rating)}★ — "${String(body.comment).slice(0, 80)}"`,
        "/admin/reviews"
      );
    }

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return publicServerError("POST /api/reviews", error);
  }
}
