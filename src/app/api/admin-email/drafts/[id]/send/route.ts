import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { getDraft, getMailbox, getThread, recordOutbound, recordBroadcast, deleteDraft, loadDraftAttachmentsForSend, linkDraftAttachmentsToMessage } from "@/lib/email-inbox";
import { requirePermission } from "@/lib/admin-permissions-server";
import { getVerifiedAdminId } from "@/lib/admin-session";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { htmlToText, wrapEmailHtml } from "@/lib/email-html";

export const dynamic = "force-dynamic";

// POST — send a saved draft. Drafting is gated by "draft", but actually SENDING
// still requires "add" (send) — so an admin who can only draft cannot send.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, "email_inbox", "add");
  if (denied) return denied;
  await ensureEmailInboxTables();
  const { id } = await params;

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Email sending is not configured (RESEND_API_KEY / EMAIL_FROM)" }, { status: 503 });
  }

  const draft = await getDraft(id);
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (!draft.body_text || !draft.body_text.trim()) return NextResponse.json({ error: "Draft body is empty" }, { status: 400 });

  const mailbox = draft.mailbox_id ? await getMailbox(draft.mailbox_id) : null;
  if (!mailbox) return NextResponse.json({ error: "Draft has no valid mailbox" }, { status: 400 });

  // Draft body_text holds the editor's HTML.
  const html = wrapEmailHtml(draft.body_text);
  const text = htmlToText(draft.body_text);
  const fromLine = `${mailbox.display_name} <${mailbox.address}>`;
  const attachments = await loadDraftAttachmentsForSend(id);

  if (draft.kind === "reply") {
    if (!mailbox.can_send) return NextResponse.json({ error: "This mailbox cannot send replies" }, { status: 400 });
    const to = draft.to_address || "";
    if (!to) return NextResponse.json({ error: "Draft has no recipient" }, { status: 400 });
    const result = await sendEmail({ to, subject: draft.subject, html, text, from: fromLine, attachments });
    if (!result.success) return NextResponse.json({ error: result.error || "Could not send" }, { status: 502 });

    // Attach to the originating thread if it still exists; move the draft's
    // attachment records onto the sent message so they show in the thread.
    // (deleteDraft would cascade nothing — attachments FK-less — so relink
    // BEFORE deleting the draft.)
    if (draft.thread_id && (await getThread(draft.thread_id))) {
      const messageId = await recordOutbound({
        threadId: draft.thread_id, mailbox, toAddress: to,
        subject: draft.subject, bodyHtml: html, bodyText: text, sentBy: getVerifiedAdminId(req),
      });
      await linkDraftAttachmentsToMessage(id, messageId);
    }
    await deleteDraft(id);
    return NextResponse.json({ ok: true, kind: "reply" });
  }

  // Broadcast draft
  if (!mailbox.can_broadcast) return NextResponse.json({ error: "This mailbox is not enabled for broadcasts" }, { status: 400 });
  const segment = (draft.segment && typeof draft.segment === "object" ? draft.segment : { type: "all" }) as { type?: string; value?: number };

  let sql = "SELECT DISTINCT email FROM customers WHERE email IS NOT NULL AND email <> '' AND is_active = 1";
  const p: (string | number)[] = [];
  if (segment.type === "registered") sql += " AND account_type = 'registered'";
  else if (segment.type === "min_spent") { sql += " AND total_spent >= ?"; p.push(Number(segment.value) || 0); }
  const rows = await query<RowDataPacket[]>(sql, p);
  const recipients = rows.map((r) => String(r.email).trim()).filter(Boolean);
  if (recipients.length === 0) return NextResponse.json({ error: "No customers match that segment" }, { status: 400 });

  let sent = 0, failed = 0;
  const CONCURRENCY = 5;
  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const batch = recipients.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((to) => sendEmail({ to, subject: draft.subject, html, text, from: fromLine, attachments })));
    for (const r of results) r.success ? sent++ : failed++;
  }
  await recordBroadcast({
    mailbox, subject: draft.subject, bodyHtml: html, segment,
    recipientCount: recipients.length, sentCount: sent, failedCount: failed, sentBy: getVerifiedAdminId(req),
  });
  await deleteDraft(id);
  return NextResponse.json({ ok: true, kind: "broadcast", recipient_count: recipients.length, sent, failed });
}
