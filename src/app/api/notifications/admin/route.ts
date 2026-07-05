import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { ensureAdminNotificationTable } from "@/lib/notify";

export const dynamic = "force-dynamic";

// GET /api/notifications/admin — incoming admin notifications (?count_only=1 for badge)
export async function GET(req: NextRequest) {
  try {
    await ensureAdminNotificationTable();

    if (req.nextUrl.searchParams.get("count_only")) {
      const rows = await query<RowDataPacket[]>(
        "SELECT COUNT(*) AS unread FROM admin_notifications WHERE is_read = FALSE"
      );
      return NextResponse.json({ unread: Number(rows[0]?.unread) || 0 });
    }

    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 30"
    );
    return NextResponse.json(rows.map((r) => ({ ...r, is_read: !!r.is_read })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// POST /api/notifications/admin — mark read
export async function POST(req: NextRequest) {
  try {
    await ensureAdminNotificationTable();
    const body = await req.json();

    if (body.action === "mark_all_read") {
      await execute("UPDATE admin_notifications SET is_read = TRUE WHERE is_read = FALSE");
      return NextResponse.json({ success: true });
    }
    if (body.action === "mark_read" && body.id) {
      await execute("UPDATE admin_notifications SET is_read = TRUE WHERE id = ?", [body.id]);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
