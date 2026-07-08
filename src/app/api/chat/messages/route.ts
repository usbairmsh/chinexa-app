import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { ensureChatTables, newMessageId } from "@/lib/chat";
import { notifyAdmin, bulkNotify } from "@/lib/notify";

export const dynamic = "force-dynamic";

// GET — message history for a conversation. Customers only see the last 30
// days (older messages stay in the DB for admin's full record, per design).
// Pass `after_id` to fetch only messages newer than a given message id —
// used by the polling loop so it doesn't re-download the whole thread on
// every tick, just the (usually empty) delta since the last check.
//
// Pass `viewer` ("customer" | "admin") alongside `after_id` to also get back
// the current read-state of the viewer's own last outgoing message. Delta
// polling by definition never re-fetches rows the client already has, so
// without this a "Seen" receipt that flips after the poll's cursor would
// never reach a client that's already rendered that message — this reports
// just that one flag instead of forcing a full thread reload.
export async function GET(req: NextRequest) {
  await ensureChatTables();
  const { searchParams } = req.nextUrl;
  const conversationId = searchParams.get("conversation_id");
  const forAdmin = searchParams.get("admin") === "1";
  const afterId = searchParams.get("after_id");
  const viewer = searchParams.get("viewer") as "customer" | "admin" | null;
  if (!conversationId) {
    return NextResponse.json({ error: "conversation_id required" }, { status: 400 });
  }

  try {
    if (afterId) {
      const afterRows = await query<RowDataPacket[]>("SELECT created_at FROM chat_messages WHERE id = ?", [afterId]);
      const afterTime = afterRows[0]?.created_at ?? "1970-01-01";
      const rows = await query<RowDataPacket[]>(
        "SELECT * FROM chat_messages WHERE conversation_id = ? AND created_at > ? ORDER BY created_at ASC",
        [conversationId, afterTime]
      );

      let lastOwnMessageReadState: { id: string; is_read: boolean } | null = null;
      if (viewer) {
        const ownRows = await query<RowDataPacket[]>(
          "SELECT id, is_read FROM chat_messages WHERE conversation_id = ? AND sender_type = ? ORDER BY created_at DESC LIMIT 1",
          [conversationId, viewer]
        );
        if (ownRows.length > 0) {
          lastOwnMessageReadState = { id: ownRows[0].id as string, is_read: !!ownRows[0].is_read };
        }
      }

      return NextResponse.json({ messages: rows, lastOwnMessageReadState });
    }

    const rows = await query<RowDataPacket[]>(
      forAdmin
        ? "SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC"
        : "SELECT * FROM chat_messages WHERE conversation_id = ? AND created_at > (NOW() - INTERVAL 30 DAY) ORDER BY created_at ASC",
      [conversationId]
    );
    return NextResponse.json(rows);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// POST — send a message, either from the customer/guest widget or the admin inbox.
export async function POST(req: NextRequest) {
  await ensureChatTables();
  try {
    const body = await req.json();
    const { conversation_id, sender_type, sender_label, flag, message } = body as {
      conversation_id: string;
      sender_type: "customer" | "admin";
      sender_label?: string;
      flag?: "general" | "help_and_support";
      message: string;
    };

    if (!conversation_id || !sender_type || !message?.trim()) {
      return NextResponse.json({ error: "conversation_id, sender_type and message are required" }, { status: 400 });
    }

    const convRows = await query<RowDataPacket[]>("SELECT * FROM chat_conversations WHERE id = ?", [conversation_id]);
    if (convRows.length === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    const conversation = convRows[0];

    const id = newMessageId();
    await execute(
      "INSERT INTO chat_messages (id, conversation_id, sender_type, sender_label, flag, body) VALUES (?, ?, ?, ?, ?, ?)",
      [id, conversation_id, sender_type, sender_label || null, flag || "general", message.trim()]
    );

    // The other side's unread counter goes up; sending clears your own.
    if (sender_type === "customer") {
      await execute(
        "UPDATE chat_conversations SET admin_unread = admin_unread + 1, customer_unread = 0, status = 'open', last_message_at = CURRENT_TIMESTAMP WHERE id = ?",
        [conversation_id]
      );
      await notifyAdmin(
        "chat",
        flag === "help_and_support" ? `Help request from ${conversation.display_name}` : `New message from ${conversation.display_name}`,
        message.trim().slice(0, 200),
        "/admin/support-inbox"
      );
    } else {
      await execute(
        "UPDATE chat_conversations SET customer_unread = customer_unread + 1, admin_unread = 0, last_message_at = CURRENT_TIMESTAMP WHERE id = ?",
        [conversation_id]
      );
      if (conversation.customer_id) {
        await bulkNotify([conversation.customer_id as string], {
          type: "system",
          title: "New reply from support",
          message: message.trim().slice(0, 200),
          link: "/dashboard",
        });
      }
    }

    const inserted = await query<RowDataPacket[]>("SELECT * FROM chat_messages WHERE id = ?", [id]);
    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
