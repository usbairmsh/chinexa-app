import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

interface TopProductRow extends RowDataPacket { id: string; name: string; total_sold: number; revenue: number; }

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const limit = Number(new URL(req.url).searchParams.get("limit")) || 5;
    const rows = await query<TopProductRow[]>(`
      SELECT oi.product_id as id, oi.product_name as name,
             SUM(oi.quantity) as total_sold, SUM(oi.total_price) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'received' AND o.payment_status = 'paid'
      GROUP BY oi.product_id, oi.product_name
      ORDER BY revenue DESC LIMIT ?
    `, [limit]);

    return NextResponse.json(rows.map((r) => ({
      id: r.id, name: r.name, total_sold: Number(r.total_sold), revenue: Number(r.revenue),
      image: `https://picsum.photos/seed/top-${r.id}/100/100`,
    })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
