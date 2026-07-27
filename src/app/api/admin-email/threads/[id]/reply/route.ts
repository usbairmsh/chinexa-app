import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { getThread, getMailbox, recordOutbound } from "@/lib/email-inbox";
import { requirePermission } from "@/lib/admin-permissions-server";
import { getVerifiedAdminId } from "@/lib/admin-session";
import { sendEmail, isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST — reply to a thread. Sends via the thread's mailbox address (so the
// customer sees the reply coming from support@/info@/… ) and stores the
// outbound copy. Requires email_inbox "add" (send) permission.
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
  const text = String(body.body || "").trim();
  if (!text) return NextResponse.json({ error: "Reply cannot be empty" }, { status: 400 });

  const subject = thread.subject.toLowerCase().startsWith("re:") ? thread.subject : `Re: ${thread.subject}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#2f3b3a;white-space:pre-wrap;">${escapeHtml(text)}</div>`;

  const result = await sendEmail({
    to: thread.correspondent,
    subject,
    html,
    text,
    // Send AS the mailbox address so replies come back to the same inbox.
    replyTo: mailbox.address,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error || "Could not send reply" }, { status: 502 });
  }

  await recordOutbound({
    threadId: id,
    mailbox,
    toAddress: thread.correspondent,
    subject,
    bodyHtml: html,
    bodyText: text,
    sentBy: getVerifiedAdminId(req),
  });

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
