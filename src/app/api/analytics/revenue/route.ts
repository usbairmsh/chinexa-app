import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

interface RevenueRow extends RowDataPacket { label: string; value: number; }

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const period = new URL(req.url).searchParams.get("period") || "30d";

    let sql = "";
    if (period === "7d") {
      sql = `SELECT DATE_FORMAT(created_at, '%a') as label, COALESCE(SUM(total), 0) as value
             FROM orders WHERE status = 'received' AND payment_status = 'paid' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             GROUP BY DATE(created_at), label ORDER BY DATE(created_at)`;
    } else if (period === "30d") {
      sql = `SELECT DATE_FORMAT(created_at, '%b %d') as label, COALESCE(SUM(total), 0) as value
             FROM orders WHERE status = 'received' AND payment_status = 'paid' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at), label ORDER BY DATE(created_at)`;
    } else if (period === "90d") {
      sql = `SELECT CONCAT('Week ', WEEK(created_at) - WEEK(DATE_SUB(NOW(), INTERVAL 90 DAY)) + 1) as label, COALESCE(SUM(total), 0) as value
             FROM orders WHERE status = 'received' AND payment_status = 'paid' AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
             GROUP BY YEARWEEK(created_at), label ORDER BY YEARWEEK(created_at)`;
    } else {
      sql = `SELECT DATE_FORMAT(created_at, '%b') as label, COALESCE(SUM(total), 0) as value
             FROM orders WHERE status = 'received' AND payment_status = 'paid' AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
             GROUP BY YEAR(created_at), MONTH(created_at), label ORDER BY YEAR(created_at), MONTH(created_at)`;
    }

    const rows = await query<RevenueRow[]>(sql);
    return NextResponse.json(rows.map((r) => ({ label: r.label, value: Number(r.value) })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
