import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, escapeLike } from "@/lib/db";
import { purgeOldActivity } from "@/lib/migrate-activity-log";

export const dynamic = "force-dynamic";

// GET /api/activity-log
//   ?entity_type=order        — access type filter (all | order | product | …)
//   ?from=2026-07-01          — date range start (inclusive, YYYY-MM-DD)
//   ?to=2026-07-21            — date range end (inclusive, whole day)
//   ?search=fahim            — matches admin display name OR username
//   ?limit=200               — capped at 500
export async function GET(req: NextRequest) {
  try {
    // Enforce the 1-month retention window (self-throttled to once an hour).
    await purgeOldActivity();

    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(Math.floor(Number(searchParams.get("limit")) || 100), 500));
    const entityType = searchParams.get("entity_type");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const search = (searchParams.get("search") || "").trim().slice(0, 100);

    // LEFT JOIN admin_users so a search can match the CURRENT username of the
    // acting admin (usernames can change; the log stores a name snapshot but no
    // username). Rows whose admin was deleted still show their stored user_name.
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (entityType && entityType !== "all") {
      where.push("al.entity_type = ?");
      params.push(entityType);
    }
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      where.push("al.created_at >= ?");
      params.push(`${from} 00:00:00`);
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      where.push("al.created_at <= ?");
      params.push(`${to} 23:59:59`);
    }
    if (search) {
      const like = `%${escapeLike(search)}%`;
      where.push("(al.user_name LIKE ? OR au.username LIKE ?)");
      params.push(like, like);
    }

    // Login and self-profile edits are routine self-activity, not audit-worthy
    // admin actions — filter them out defensively at read time too, so any
    // historical rows written before these stopped being logged don't show.
    where.push("al.action NOT IN ('Admin logged in', 'Updated admin profile')");

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const rows = await query<RowDataPacket[]>(
      `SELECT al.*, au.username AS user_username
       FROM activity_log al
       LEFT JOIN admin_users au ON au.id = al.user_id
       ${whereSql}
       ORDER BY al.created_at DESC
       LIMIT ${limit}`,
      params
    );
    return NextResponse.json(rows);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
