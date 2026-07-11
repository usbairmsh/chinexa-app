import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensureChatTables } from "@/lib/chat";
import { publicServerError } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureChatTables();
  const { searchParams } = req.nextUrl;
  const forAdmin = searchParams.get("admin") === "1";

  try {
    if (forAdmin) {
      const rows = await query<RowDataPacket[]>(
        "SELECT COALESCE(SUM(admin_unread), 0) AS unread FROM chat_conversations"
      );
      return NextResponse.json({ unread: Number(rows[0]?.unread) || 0 });
    }

    const customerId = searchParams.get("customer_id");
    const guestId = searchParams.get("guest_id");
    if (!customerId && !guestId) {
      return NextResponse.json({ unread: 0 });
    }
    const rows = await query<RowDataPacket[]>(
      customerId
        ? "SELECT customer_unread FROM chat_conversations WHERE customer_id = ? LIMIT 1"
        : "SELECT customer_unread FROM chat_conversations WHERE guest_id = ? LIMIT 1",
      [customerId || guestId!]
    );
    return NextResponse.json({ unread: rows.length > 0 ? Number(rows[0].customer_unread) || 0 : 0 });
  } catch (error: unknown) {
    return publicServerError("GET /api/chat/unread-count", error);
  }
}
