import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/notifications?customer_id=xxx
export async function GET(req: NextRequest) {
  try {
    const customerId = req.nextUrl.searchParams.get("customer_id");
    if (!customerId) return NextResponse.json({ error: "customer_id required" }, { status: 400 });

    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM customer_notifications WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50",
      [customerId]
    );
    return NextResponse.json(rows.map((r) => ({ ...r, is_read: !!r.is_read })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// POST /api/notifications — create notification + mark read
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Mark all as read
    if (body.action === "mark_all_read" && body.customer_id) {
      await execute("UPDATE customer_notifications SET is_read = TRUE WHERE customer_id = ?", [body.customer_id]);
      return NextResponse.json({ success: true });
    }

    // Mark single as read
    if (body.action === "mark_read" && body.id) {
      await execute("UPDATE customer_notifications SET is_read = TRUE WHERE id = ?", [body.id]);
      return NextResponse.json({ success: true });
    }

    // Create notification
    if (body.customer_id && body.title && body.message) {
      const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await execute(
        "INSERT INTO customer_notifications (id, customer_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)",
        [id, body.customer_id, body.type || "system", body.title, body.message, body.link || null]
      );
      return NextResponse.json({ success: true, id }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
