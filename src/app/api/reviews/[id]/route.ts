import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.is_approved !== undefined) await execute("UPDATE reviews SET is_approved = ? WHERE id = ?", [body.is_approved ? 1 : 0, id]);
    if (body.admin_reply !== undefined) await execute("UPDATE reviews SET admin_reply = ? WHERE id = ?", [body.admin_reply, id]);

    // Recalculate product average_rating and review_count from approved reviews
    if (body.is_approved !== undefined) {
      const reviewRows = await query<RowDataPacket[]>("SELECT product_id FROM reviews WHERE id = ?", [id]);
      if (reviewRows.length > 0) {
        const productId = reviewRows[0].product_id as string;
        const stats = await query<RowDataPacket[]>(
          "SELECT COUNT(*) as cnt, COALESCE(AVG(rating), 0) as avg_rating FROM reviews WHERE product_id = ? AND is_approved = 1",
          [productId]
        );
        const cnt = Number(stats[0]?.cnt) || 0;
        const avgRating = Math.round((Number(stats[0]?.avg_rating) || 0) * 100) / 100;
        await execute("UPDATE products SET review_count = ?, average_rating = ? WHERE id = ?", [cnt, avgRating, productId]);
      }
    }

    if (body.is_approved !== undefined) await logActivity(body.is_approved ? "Approved review" : "Rejected review", "review", id);
    if (body.admin_reply !== undefined) await logActivity("Replied to review", "review", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; await execute("DELETE FROM reviews WHERE id = ?", [id]); await logActivity("Deleted review", "review", id); return NextResponse.json({ success: true }); }
  catch (error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 }); }
}
