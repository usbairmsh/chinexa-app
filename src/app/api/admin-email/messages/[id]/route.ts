import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { deleteMessage, getMessageMailboxId } from "@/lib/email-inbox";
import { requirePermission, requireMailboxAccess } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

// DELETE — hard-remove a single message from a thread (and the thread too if it
// was the last one). Requires email_inbox "delete" + access to its mailbox.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, "email_inbox", "delete");
  if (denied) return denied;
  await ensureEmailInboxTables();
  const { id } = await params;

  const mailboxId = await getMessageMailboxId(id);
  if (!mailboxId) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  const noAccess = await requireMailboxAccess(req, mailboxId, "delete");
  if (noAccess) return noAccess;

  const result = await deleteMessage(id);
  if (!result) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  return NextResponse.json({ ok: true, thread_deleted: result.threadDeleted, thread_id: result.threadId });
}
