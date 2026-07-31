import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { getThread, getThreadMessages, getMailbox, openOutboundThread, recordOutbound, loadAttachmentsForSend, linkAttachmentsToMessage } from "@/lib/email-inbox";
import { requirePermission, requireMailboxAccess } from "@/lib/admin-permissions-server";
import { getVerifiedAdminId } from "@/lib/admin-session";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { htmlToText, wrapEmailHtml } from "@/lib/email-html";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const parseList = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  if (typeof v === "string") return v.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  return [];
};

// POST — forward a thread (or one message in it) to new recipients. Sends via
// the thread's mailbox, quotes the source content (optionally with an admin
// note on top), and opens a new outbound thread per recipient. Requires
// email_inbox "add" + access to the thread's mailbox.
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
  const noAccess = await requireMailboxAccess(req, thread.mailbox_id, "add");
  if (noAccess) return noAccess;
  const mailbox = await getMailbox(thread.mailbox_id);
  if (!mailbox || !mailbox.can_send) {
    return NextResponse.json({ error: "This mailbox cannot send email" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const to = parseList(body.to);
  const cc = parseList(body.cc);
  const bcc = parseList(body.bcc);
  const note = String(body.note || "").trim();
  const messageId = typeof body.message_id === "string" ? body.message_id : null;
  const composeToken = typeof body.compose_token === "string" ? body.compose_token : null;

  if (to.length === 0) return NextResponse.json({ error: "Add at least one recipient" }, { status: 400 });
  const invalid = [...to, ...cc, ...bcc].filter((e) => !EMAIL_RE.test(e));
  if (invalid.length) return NextResponse.json({ error: `Invalid email address: ${invalid.join(", ")}` }, { status: 400 });

  // Build the forwarded content: optional admin note, then the quoted source.
  const messages = await getThreadMessages(id);
  const source = messageId ? messages.find((m) => m.id === messageId) : messages[messages.length - 1];
  if (!source) return NextResponse.json({ error: "Nothing to forward" }, { status: 400 });

  const quoted = `
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e5e5;color:#555">
      <p style="font-size:12px;color:#888;margin:0 0 8px">---------- Forwarded message ----------<br/>
      From: ${escapeHtml(source.from_address)}<br/>
      To: ${escapeHtml(source.to_address)}<br/>
      Subject: ${escapeHtml(source.subject)}</p>
      ${source.body_html && source.body_html.trim() ? source.body_html : `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(source.body_text || "")}</pre>`}
    </div>`;
  const noteHtml = note ? `<p>${escapeHtml(note).replace(/\n/g, "<br/>")}</p>` : "";
  const composed = `${noteHtml}${quoted}`;
  const html = wrapEmailHtml(composed);
  const text = htmlToText(composed);

  const subject = /^fwd:/i.test(source.subject) ? source.subject : `Fwd: ${source.subject}`;
  const attachments = await loadAttachmentsForSend(composeToken);
  const fromLine = `${mailbox.display_name} <${mailbox.address}>`;
  const sentBy = getVerifiedAdminId(req);

  const threads: string[] = [];
  let sent = 0, failed = 0, firstMsgId: string | null = null;
  for (const recipient of to) {
    const result = await sendEmail({ to: recipient, subject, html, text, from: fromLine, cc, bcc, attachments });
    if (!result.success) { failed++; continue; }
    sent++;
    const threadId = await openOutboundThread({ mailbox, toAddress: recipient, subject });
    const outId = await recordOutbound({ threadId, mailbox, toAddress: recipient, subject, bodyHtml: html, bodyText: text, sentBy, cc, bcc });
    if (!firstMsgId) firstMsgId = outId;
    threads.push(threadId);
  }
  if (composeToken && firstMsgId) await linkAttachmentsToMessage(composeToken, firstMsgId);

  if (sent === 0) return NextResponse.json({ error: "Could not forward to any recipient" }, { status: 502 });
  return NextResponse.json({ ok: true, sent, failed, threads });
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}
