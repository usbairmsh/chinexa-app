import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { deleteMessage } from "@/lib/email-inbox";
import { requirePermission } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

// DELETE — remove a single message (sent or received) from a thread. If it was
// the last message, its now-empty thread is removed too. Requires the
// email_inbox "delete" permission.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, "email_inbox", "delete");
  if (denied) return denied;
  await ensureEmailInboxTables();
  const { id } = await params;

  const result = await deleteMessage(id);
  if (!result) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  return NextResponse.json({ ok: true, thread_deleted: result.threadDeleted, thread_id: result.threadId });
}
