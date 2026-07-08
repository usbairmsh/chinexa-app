import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { ensureChatTables } from "@/lib/chat";

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
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
