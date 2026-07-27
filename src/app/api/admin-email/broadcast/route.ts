import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { getMailbox, recordBroadcast } from "@/lib/email-inbox";
import { requirePermission } from "@/lib/admin-permissions-server";
import { getVerifiedAdminId } from "@/lib/admin-session";
import { sendEmail, isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

// POST — broadcast a (no-reply) email to a customer segment. Sends from a
// mailbox flagged can_broadcast. Segments are DB-backed and intentionally
// simple (columns that actually exist on `customers`):
//   { type: "all" }                          — every customer with an email
//   { type: "registered" }                   — account_type = 'registered'
//   { type: "min_spent", value: <number> }   — total_spent >= value
export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, "email_inbox", "add");
  if (denied) return denied;
  await ensureEmailInboxTables();

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Email sending is not configured (RESEND_API_KEY / EMAIL_FROM)" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const mailboxId = String(body.mailbox_id || "");
  const subject = String(body.subject || "").trim();
  const message = String(body.body || "").trim();
  const segment = body.segment && typeof body.segment === "object" ? body.segment : { type: "all" };

  if (!subject || !message) return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });

  const mailbox = await getMailbox(mailboxId);
  if (!mailbox || !mailbox.can_broadcast) {
    return NextResponse.json({ error: "Choose a mailbox enabled for broadcasts" }, { status: 400 });
  }

  // Resolve the segment to recipient emails.
  let sql = "SELECT DISTINCT email FROM customers WHERE email IS NOT NULL AND email <> '' AND is_active = 1";
  const params: (string | number)[] = [];
  if (segment.type === "registered") {
    sql += " AND account_type = 'registered'";
  } else if (segment.type === "min_spent") {
    sql += " AND total_spent >= ?";
    params.push(Number(segment.value) || 0);
  }
  const rows = await query<RowDataPacket[]>(sql, params);
  const recipients = rows.map((r) => String(r.email).trim()).filter(Boolean);

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No customers with an email match that segment" }, { status: 400 });
  }

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#2f3b3a;white-space:pre-wrap;">${escapeHtml(message)}</div>`;

  // Best-effort, sequential-with-small-concurrency send. Each recipient gets an
  // individual email (no shared To: header) so addresses aren't leaked.
  let sent = 0, failed = 0;
  const CONCURRENCY = 5;
  for (let i = 0; i < recipients.length; i += CONCURRENCY) {
    const batch = recipients.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((to) => sendEmail({ to, subject, html, text: message, from: `${mailbox.display_name} <${mailbox.address}>` }))
    );
    for (const r of results) r.success ? sent++ : failed++;
  }

  await recordBroadcast({
    mailbox, subject, bodyHtml: html, segment,
    recipientCount: recipients.length, sentCount: sent, failedCount: failed,
    sentBy: getVerifiedAdminId(req),
  });

  return NextResponse.json({ ok: true, recipient_count: recipients.length, sent, failed });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
