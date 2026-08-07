import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { requirePermission } from "@/lib/admin-permissions-server";
import { query } from "@/lib/db";
import { ensurePageViewsTable } from "@/lib/migrate-analytics";
import { ensureOrderArchiveColumns } from "@/lib/migrate-order-archive";

export const dynamic = "force-dynamic";

interface VisitorRow extends RowDataPacket { d: string; visitors: number; }
interface OrderRow extends RowDataPacket { d: string; orders: number; }

// Real Traffic & Conversions for the last 7 days, from our own DB:
//   - visitors: distinct daily visitor hashes from page_views (bots excluded)
//   - conversions: non-archived orders placed that day
// The result is always a 7-entry series (today back 6 days), 0-filled for any
// day with no data, so the dashboard chart never renders blank.
export async function GET(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "analytics", "view");
    if (denied) return denied;
    await Promise.all([ensurePageViewsTable(), ensureOrderArchiveColumns()]);

    const [visitorRows, orderRows] = await Promise.all([
      query<VisitorRow[]>(`
        SELECT DATE(created_at) AS d, COUNT(DISTINCT visitor_id) AS visitors
        FROM page_views
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND is_bot = 0
        GROUP BY DATE(created_at)
      `),
      query<OrderRow[]>(`
        SELECT DATE(created_at) AS d, COUNT(*) AS orders
        FROM orders
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND is_archived = 0
        GROUP BY DATE(created_at)
      `),
    ]);

    const key = (dt: Date) => dt.toISOString().slice(0, 10);
    const visitorsByDay = new Map(visitorRows.map((r) => [key(new Date(r.d)), Number(r.visitors)]));
    const ordersByDay = new Map(orderRows.map((r) => [key(new Date(r.d)), Number(r.orders)]));

    // Build the fixed 7-day window (oldest → newest) so the X-axis is stable
    // and every day is present even with zero traffic.
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const series = Array.from({ length: 7 }).map((_, i) => {
      const dt = new Date(now);
      dt.setDate(now.getDate() - (6 - i));
      const k = key(dt);
      return {
        day: days[dt.getDay()],
        visitors: visitorsByDay.get(k) || 0,
        conversions: ordersByDay.get(k) || 0,
      };
    });

    return NextResponse.json(series);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
