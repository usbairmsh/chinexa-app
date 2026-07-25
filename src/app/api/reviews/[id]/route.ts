import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import pool, { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { requirePermission } from "@/lib/admin-permissions-server";

// Recompute a product's average_rating + review_count from its approved
// reviews, locked+transactional. Shared by approve/unapprove (PUT) and delete
// (DELETE) so removing an approved review no longer leaves stale stars.
async function recomputeProductRating(productId: string) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("SELECT id FROM products WHERE id = ? FOR UPDATE", [productId]);
    const [stats] = await conn.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt, COALESCE(AVG(rating), 0) as avg_rating FROM reviews WHERE product_id = ? AND is_approved = 1",
      [productId]
    );
    const cnt = Number(stats[0]?.cnt) || 0;
    const avgRating = Math.round((Number(stats[0]?.avg_rating) || 0) * 100) / 100;
    await conn.execute("UPDATE products SET review_count = ?, average_rating = ? WHERE id = ?", [cnt, avgRating, productId]);
    await conn.commit();
    conn.release();
  } catch (txError) {
    await conn.rollback().catch(() => {});
    conn.release();
    throw txError;
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "reviews", "approve");
    if (denied) return denied;
    const { id } = await params;
    const body = await req.json();
    if (body.is_approved !== undefined) await execute("UPDATE reviews SET is_approved = ? WHERE id = ?", [body.is_approved ? 1 : 0, id]);
    if (body.admin_reply !== undefined) await execute("UPDATE reviews SET admin_reply = ? WHERE id = ?", [body.admin_reply, id]);

    // Recalculate the product's rating whenever approval state changes.
    if (body.is_approved !== undefined) {
      const reviewRows = await query<RowDataPacket[]>("SELECT product_id FROM reviews WHERE id = ?", [id]);
      if (reviewRows.length > 0) await recomputeProductRating(reviewRows[0].product_id as string);
    }

    if (body.is_approved !== undefined) await logActivity(body.is_approved ? "Approved review" : "Rejected review", "review", id);
    if (body.admin_reply !== undefined) await logActivity("Replied to review", "review", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "reviews", "delete");
    if (denied) return denied;
    const { id } = await params;
    // Capture the product first so we can refresh its stars after deletion —
    // deleting an APPROVED review must not leave a stale review_count/rating.
    const rows = await query<RowDataPacket[]>("SELECT product_id, is_approved FROM reviews WHERE id = ?", [id]);
    await execute("DELETE FROM reviews WHERE id = ?", [id]);
    if (rows.length > 0 && rows[0].is_approved) {
      await recomputeProductRating(rows[0].product_id as string).catch(() => {});
    }
    await logActivity("Deleted review", "review", id);
    return NextResponse.json({ success: true });
  }
  catch (error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 }); }
}
