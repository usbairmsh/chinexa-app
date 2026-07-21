import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensureOrderArchiveColumns } from "@/lib/migrate-order-archive";

interface DemandRow extends RowDataPacket {
  id: string; name: string; slug: string | null; total_qty: number; order_count: number; image_url: string | null;
}

export const dynamic = "force-dynamic";

// GET /api/analytics/most-demanded?limit=5
// "Most demanded" = total quantity ordered across all NON-ARCHIVED orders,
// regardless of fulfilment status (demand ≠ delivered revenue). Archived orders
// are excluded per requirement. Cancelled/returned are still real demand signals
// so they're intentionally counted; only archiving removes an order from view.
export async function GET(req: NextRequest) {
  try {
    await ensureOrderArchiveColumns();
    const limit = Math.max(1, Math.min(Number(new URL(req.url).searchParams.get("limit")) || 5, 20));

    const rows = await query<DemandRow[]>(`
      SELECT oi.product_id AS id,
             oi.product_name AS name,
             p.slug AS slug,
             SUM(oi.quantity) AS total_qty,
             COUNT(DISTINCT oi.order_id) AS order_count,
             first_img.url AS image_url
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN (
        SELECT product_id, MIN(url) AS url FROM product_images pi
        WHERE \`order\` = (SELECT MIN(\`order\`) FROM product_images WHERE product_id = pi.product_id)
        GROUP BY product_id
      ) first_img ON first_img.product_id = oi.product_id
      WHERE COALESCE(o.is_archived, 0) = 0
        AND oi.product_id IS NOT NULL
      GROUP BY oi.product_id, oi.product_name, p.slug, first_img.url
      ORDER BY total_qty DESC, order_count DESC
      LIMIT ${limit}
    `);

    return NextResponse.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug || null,
      total_qty: Number(r.total_qty) || 0,
      order_count: Number(r.order_count) || 0,
      image: r.image_url || `https://picsum.photos/seed/demand-${r.id}/100/100`,
    })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
