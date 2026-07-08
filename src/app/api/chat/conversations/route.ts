import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { ensureChatTables, newConversationId } from "@/lib/chat";

export const dynamic = "force-dynamic";

// GET — admin: list all conversations, sorted by most recent activity.
//       customer/guest: get-or-create their own single conversation.
export async function GET(req: NextRequest) {
  await ensureChatTables();
  const { searchParams } = req.nextUrl;
  const forAdmin = searchParams.get("admin") === "1";

  try {
    if (forAdmin) {
      const rows = await query<RowDataPacket[]>(
        `SELECT * FROM chat_conversations ORDER BY last_message_at DESC`
      );
      return NextResponse.json(rows);
    }

    const customerId = searchParams.get("customer_id");
    const guestId = searchParams.get("guest_id");
    const displayName = searchParams.get("display_name") || "Guest";
    if (!customerId && !guestId) {
      return NextResponse.json({ error: "customer_id or guest_id required" }, { status: 400 });
    }

    const existing = await query<RowDataPacket[]>(
      customerId
        ? "SELECT * FROM chat_conversations WHERE customer_id = ? LIMIT 1"
        : "SELECT * FROM chat_conversations WHERE guest_id = ? LIMIT 1",
      [customerId || guestId!]
    );
    if (existing.length > 0) {
      // Keep the stored display name current (e.g. phone number may not have
      // been known yet when a guest conversation was first created).
      if (existing[0].display_name !== displayName) {
        await execute("UPDATE chat_conversations SET display_name = ? WHERE id = ?", [displayName, existing[0].id]);
        existing[0].display_name = displayName;
      }
      return NextResponse.json(existing[0]);
    }

    const id = newConversationId();
    await execute(
      "INSERT INTO chat_conversations (id, customer_id, guest_id, display_name) VALUES (?, ?, ?, ?)",
      [id, customerId || null, customerId ? null : guestId, displayName]
    );
    const created = await query<RowDataPacket[]>("SELECT * FROM chat_conversations WHERE id = ?", [id]);
    return NextResponse.json(created[0]);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// DELETE — admin only: permanently remove a conversation and all its
// messages (chat_messages cascades via its FOREIGN KEY ... ON DELETE CASCADE).
export async function DELETE(req: NextRequest) {
  await ensureChatTables();
  const conversationId = req.nextUrl.searchParams.get("id");
  if (!conversationId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  try {
    const result = await execute("DELETE FROM chat_conversations WHERE id = ?", [conversationId]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
