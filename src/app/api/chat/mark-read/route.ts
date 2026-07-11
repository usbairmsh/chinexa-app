import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { ensureChatTables } from "@/lib/chat";
import { publicServerError } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await ensureChatTables();
  try {
    const { conversation_id, reader } = (await req.json()) as {
      conversation_id: string;
      reader: "customer" | "admin";
    };
    if (!conversation_id || !reader) {
      return NextResponse.json({ error: "conversation_id and reader are required" }, { status: 400 });
    }
    await execute(
      reader === "admin"
        ? "UPDATE chat_conversations SET admin_unread = 0 WHERE id = ?"
        : "UPDATE chat_conversations SET customer_unread = 0 WHERE id = ?",
      [conversation_id]
    );
    // Stamp "Seen" on the other side's messages — a customer reading marks the
    // admin's messages seen, and vice versa.
    const otherSender = reader === "admin" ? "customer" : "admin";
    await execute(
      "UPDATE chat_messages SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND sender_type = ? AND is_read = FALSE",
      [conversation_id, otherSender]
    );
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return publicServerError("POST /api/chat/mark-read", error);
  }
}
