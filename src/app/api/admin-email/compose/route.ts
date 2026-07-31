import { NextRequest, NextResponse } from "next/server";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { getMailbox, openOutboundThread, recordOutbound, loadAttachmentsForSend, linkAttachmentsToMessage } from "@/lib/email-inbox";
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

// POST — compose and send a 1-to-1 / official email from a mailbox to explicit
// recipients. Opens ONE thread per primary "to" recipient (so replies land in
// the right conversation), with CC/BCC included on each send. Requires
// email_inbox "add" + access to the chosen mailbox.
export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, "email_inbox", "add");
  if (denied) return denied;
  await ensureEmailInboxTables();

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Email sending is not configured (RESEND_API_KEY / EMAIL_FROM)" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const mailboxId = String(body.mailbox_id || "");
  const noAccess = await requireMailboxAccess(req, mailboxId, "add");
  if (noAccess) return noAccess;

  const to = parseList(body.to);
  const cc = parseList(body.cc);
  const bcc = parseList(body.bcc);
  const subject = String(body.subject || "").trim();
  const bodyHtml = String(body.body_html || body.body || "").trim();
  const composeToken = typeof body.compose_token === "string" ? body.compose_token : null;

  if (to.length === 0) return NextResponse.json({ error: "Add at least one recipient" }, { status: 400 });
  const invalid = [...to, ...cc, ...bcc].filter((e) => !EMAIL_RE.test(e));
  if (invalid.length) return NextResponse.json({ error: `Invalid email address: ${invalid.join(", ")}` }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  const text = htmlToText(bodyHtml);
  const attachments = await loadAttachmentsForSend(composeToken);
  if (!text && attachments.length === 0) return NextResponse.json({ error: "Email body cannot be empty" }, { status: 400 });

  const mailbox = await getMailbox(mailboxId);
  if (!mailbox || !mailbox.can_send) {
    return NextResponse.json({ error: "This mailbox cannot send email" }, { status: 400 });
  }

  const html = wrapEmailHtml(bodyHtml);
  const fromLine = `${mailbox.display_name} <${mailbox.address}>`;
  const sentBy = getVerifiedAdminId(req);

  // One thread per primary recipient. CC/BCC ride along on every send.
  const threads: string[] = [];
  let sent = 0, failed = 0;
  let firstMessageId: string | null = null;
  for (const recipient of to) {
    const result = await sendEmail({ to: recipient, subject, html, text, from: fromLine, cc, bcc, attachments });
    if (!result.success) { failed++; continue; }
    sent++;
    const threadId = await openOutboundThread({ mailbox, toAddress: recipient, subject });
    const messageId = await recordOutbound({
      threadId, mailbox, toAddress: recipient, subject, bodyHtml: html, bodyText: text, sentBy, cc, bcc,
    });
    if (!firstMessageId) firstMessageId = messageId;
    threads.push(threadId);
  }

  // Attachments are staged against the compose token; link them to the first
  // sent message so they render in the inbox (Resend already delivered copies).
  if (composeToken && firstMessageId) await linkAttachmentsToMessage(composeToken, firstMessageId);

  if (sent === 0) {
    return NextResponse.json({ error: "Could not send to any recipient" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sent, failed, threads });
}
