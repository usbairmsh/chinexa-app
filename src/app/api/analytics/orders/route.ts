import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensureOrderArchiveColumns } from "@/lib/migrate-order-archive";

interface ChartRow extends RowDataPacket { label: string; orders: number; customers: number; }

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureOrderArchiveColumns();
    const period = new URL(req.url).searchParams.get("period") || "1y";

    let sql = "";
    if (period === "7d") {
      sql = `SELECT DATE_FORMAT(o.created_at, '%a') as label, COUNT(DISTINCT o.id) as orders, COUNT(DISTINCT o.customer_id) as customers
             FROM orders o WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND o.is_archived = 0
             GROUP BY DATE(o.created_at), label ORDER BY DATE(o.created_at)`;
    } else {
      sql = `SELECT DATE_FORMAT(o.created_at, '%b') as label, COUNT(DISTINCT o.id) as orders, COUNT(DISTINCT o.customer_id) as customers
             FROM orders o WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH) AND o.is_archived = 0
             GROUP BY YEAR(o.created_at), MONTH(o.created_at), label ORDER BY YEAR(o.created_at), MONTH(o.created_at)`;
    }

    const rows = await query<ChartRow[]>(sql);
    return NextResponse.json(rows.map((r) => ({ label: r.label, orders: Number(r.orders), customers: Number(r.customers) })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
