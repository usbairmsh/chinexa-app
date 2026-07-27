import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { getThread, getMailbox, recordOutbound, loadAttachmentsForSend, linkAttachmentsToMessage } from "@/lib/email-inbox";
import { requirePermission } from "@/lib/admin-permissions-server";
import { getVerifiedAdminId } from "@/lib/admin-session";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { htmlToText, wrapEmailHtml } from "@/lib/email-html";

export const dynamic = "force-dynamic";

// POST — reply to a thread. Sends via the thread's mailbox address (so the
// customer sees the reply coming from support@/info@/… ) and stores the
// outbound copy. Body is rich HTML. Requires email_inbox "add" (send).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, "email_inbox", "add");
  if (denied) return denied;
  await ensureEmailInboxTables();
  const { id } = await params;

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Email sending is not configured (RESEND_API_KEY / EMAIL_FROM)" }, { status: 503 });
  }

  const thread = await getThread(id);
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  const mailbox = await getMailbox(thread.mailbox_id);
  if (!mailbox || !mailbox.can_send) {
    return NextResponse.json({ error: "This mailbox cannot send replies" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const bodyHtml = String(body.body_html || body.body || "").trim();
  const composeToken = typeof body.compose_token === "string" ? body.compose_token : null;
  const text = htmlToText(bodyHtml);
  const attachments = await loadAttachmentsForSend(composeToken);
  if (!text && attachments.length === 0) return NextResponse.json({ error: "Reply cannot be empty" }, { status: 400 });

  const subject = thread.subject.toLowerCase().startsWith("re:") ? thread.subject : `Re: ${thread.subject}`;
  const html = wrapEmailHtml(bodyHtml);

  const result = await sendEmail({
    to: thread.correspondent,
    subject,
    html,
    text,
    from: `${mailbox.display_name} <${mailbox.address}>`,
    attachments,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error || "Could not send reply" }, { status: 502 });
  }

  const messageId = await recordOutbound({
    threadId: id, mailbox, toAddress: thread.correspondent,
    subject, bodyHtml: html, bodyText: text, sentBy: getVerifiedAdminId(req),
  });
  if (composeToken) await linkAttachmentsToMessage(composeToken, messageId);

  return NextResponse.json({ ok: true });
}
