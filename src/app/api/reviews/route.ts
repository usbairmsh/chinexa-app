import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError, dependencyError, publicServerError } from "@/lib/validate";
import { notifyAdmin } from "@/lib/notify";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("product_id");
    const approved = searchParams.get("is_approved");
    const limit = Number(searchParams.get("limit")) || 50;

    let where = "WHERE 1=1";
    const params: (string | number)[] = [];
    if (productId) { where += " AND product_id = ?"; params.push(productId); }
    if (approved === "true") { where += " AND is_approved = 1"; }
    if (approved === "false") { where += " AND is_approved = 0"; }

    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 200));
    const rows = await query<RowDataPacket[]>(`SELECT * FROM reviews ${where} ORDER BY created_at DESC LIMIT ${safeLimit}`, params);
    return NextResponse.json(rows.map((r) => ({ ...r, is_verified_purchase: !!r.is_verified_purchase, is_approved: !!r.is_approved })));
  } catch (error: unknown) {
    return publicServerError("GET /api/reviews", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const err = validate([
      { field: "product_id", value: body.product_id, rules: ["required", "string"], label: "Product" },
      { field: "customer_name", value: body.customer_name, rules: ["required", "string", { maxLength: 255 }], label: "Customer name" },
      { field: "rating", value: Number(body.rating), rules: ["required", "number", { range: [1, 5] }], label: "Rating" },
      { field: "title", value: body.title, rules: [{ maxLength: 255 }], label: "Review title" },
      { field: "comment", value: body.comment, rules: ["required", "string", { minLength: 3 }, { maxLength: 5000 }], label: "Comment" },
    ]);
    if (err) return validationError(err);
    const productExists = await query<RowDataPacket[]>("SELECT id FROM products WHERE id = ?", [body.product_id]);
    if (productExists.length === 0) return dependencyError("Product", body.product_id);
    const id = `rev-${Date.now()}`;
    await execute(
      "INSERT INTO reviews (id, product_id, product_name, customer_id, customer_name, rating, title, comment, is_verified_purchase, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, body.product_id, body.product_name || null, body.customer_id || null, body.customer_name, body.rating, body.title || null, body.comment, body.is_verified_purchase ? 1 : 0, body.is_approved ? 1 : 0]
    );
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
