import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { getThread, getThreadMessages, markThreadRead, setThreadStatus, deleteThread, getMailbox, attachmentsForMessage } from "@/lib/email-inbox";
import { requirePermission } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

// GET — a thread's full message history (with each message's attachments).
// Opening it marks it read.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, "email_inbox", "view");
  if (denied) return denied;
  await ensureEmailInboxTables();
  const { id } = await params;

  const thread = await getThread(id);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  const [messages, mailbox] = await Promise.all([getThreadMessages(id), getMailbox(thread.mailbox_id)]);
  const withAttachments = await Promise.all(
    messages.map(async (m) => ({ ...m, attachments: await attachmentsForMessage(m.id) }))
  );
  await markThreadRead(id);
  return NextResponse.json({ thread: { ...thread, admin_unread: 0 }, messages: withAttachments, mailbox });
}

// PATCH — mark read / open-close.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, "email_inbox", "view");
  if (denied) return denied;
  await ensureEmailInboxTables();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.status === "open" || body.status === "closed") await setThreadStatus(id, body.status);
  if (body.mark_read === true) await markThreadRead(id);
  return NextResponse.json({ ok: true });
}

// DELETE — remove a thread (and its messages). Requires email_inbox delete.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, "email_inbox", "delete");
  if (denied) return denied;
  await ensureEmailInboxTables();
  const { id } = await params;
  await deleteThread(id);
  return NextResponse.json({ ok: true });
}
