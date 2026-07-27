import { type RowDataPacket, type ResultSetHeader } from "mysql2/promise";
import { query, execute } from "@/lib/db";

// Data-access helpers for the Email Center. Server-only.

let rid = 0;
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${(rid = (rid + 1) % 100000)}-${Math.random().toString(36).slice(2, 6)}`;
}
export const newMailboxId = () => genId("mbx");
export const newThreadId = () => genId("ethr");
export const newEmailMsgId = () => genId("emsg");
export const newBroadcastId = () => genId("ebrd");
export const newDraftId = () => genId("edft");

/** Strips leading Re:/Fwd:/Fw: prefixes and lowercases, so a reply's subject
 *  matches the thread it belongs to and a genuinely different subject doesn't. */
export function normalizeSubject(subject: string): string {
  return (subject || "")
    .replace(/^\s*((re|fwd?|aw|sv)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase()
    .slice(0, 255) || "(no subject)";
}

export interface Mailbox {
  id: string;
  address: string;
  display_name: string;
  is_active: boolean;
  can_receive: boolean;
  can_send: boolean;
  can_broadcast: boolean;
  created_at: string;
}

export interface EmailThread {
  id: string;
  mailbox_id: string;
  correspondent: string;
  correspondent_name: string | null;
  subject: string;
  status: "open" | "closed";
  admin_unread: number;
  message_count: number;
  last_message_at: string;
  created_at: string;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  from_address: string;
  to_address: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  created_at: string;
}

export async function listMailboxes(): Promise<Mailbox[]> {
  const rows = await query<RowDataPacket[]>(
    "SELECT * FROM email_mailboxes ORDER BY created_at ASC"
  );
  return rows.map(toMailbox);
}

export async function getMailboxByAddress(address: string): Promise<Mailbox | null> {
  const rows = await query<RowDataPacket[]>(
    "SELECT * FROM email_mailboxes WHERE address = ? LIMIT 1",
    [address.toLowerCase().trim()]
  );
  return rows.length ? toMailbox(rows[0]) : null;
}

export async function getMailbox(id: string): Promise<Mailbox | null> {
  const rows = await query<RowDataPacket[]>("SELECT * FROM email_mailboxes WHERE id = ? LIMIT 1", [id]);
  return rows.length ? toMailbox(rows[0]) : null;
}

function toMailbox(r: RowDataPacket): Mailbox {
  return {
    id: r.id, address: r.address, display_name: r.display_name,
    is_active: !!r.is_active, can_receive: !!r.can_receive,
    can_send: !!r.can_send, can_broadcast: !!r.can_broadcast,
    created_at: r.created_at,
  };
}

/**
 * Records an inbound message: finds an existing open thread for this
 * (mailbox, correspondent) — optionally matching the mail headers — or opens a
 * new one, then appends the message and bumps unread/count/recency.
 */
export async function recordInbound(params: {
  mailbox: Mailbox;
  fromAddress: string;
  fromName?: string | null;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  messageId: string | null;
  inReplyTo: string | null;
}): Promise<string> {
  const { mailbox, fromAddress, subject } = params;
  const correspondent = fromAddress.toLowerCase().trim();
  const normSubject = normalizeSubject(subject);

  // Decide whether this email continues an existing conversation or starts a
  // new one. A new email from a known correspondent must open a NEW thread —
  // only genuine replies should attach to an existing thread. We treat it as a
  // reply when either:
  //   (a) its In-Reply-To header points at a message we already have, or
  //   (b) it shares the same normalized subject (strip Re:/Fwd:) as an open
  //       thread from the same correspondent.
  // Otherwise, a fresh thread is opened.
  let threadId: string | null = null;

  if (params.inReplyTo) {
    const byHeader = await query<RowDataPacket[]>(
      `SELECT t.id FROM email_messages m
       JOIN email_threads t ON t.id = m.thread_id
       WHERE t.mailbox_id = ? AND m.message_id = ? LIMIT 1`,
      [mailbox.id, params.inReplyTo]
    );
    if (byHeader.length) threadId = byHeader[0].id as string;
  }

  if (!threadId) {
    const bySubject = await query<RowDataPacket[]>(
      `SELECT id FROM email_threads
       WHERE mailbox_id = ? AND correspondent = ? AND status = 'open'
         AND norm_subject = ?
       ORDER BY last_message_at DESC LIMIT 1`,
      [mailbox.id, correspondent, normSubject]
    );
    if (bySubject.length) threadId = bySubject[0].id as string;
  }

  if (!threadId) {
    threadId = newThreadId();
    await execute(
      `INSERT INTO email_threads (id, mailbox_id, correspondent, correspondent_name, subject, norm_subject, status, admin_unread, message_count, last_message_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', 0, 0, CURRENT_TIMESTAMP)`,
      [threadId, mailbox.id, correspondent, params.fromName || null, subject.slice(0, 500) || "(no subject)", normSubject]
    );
  }

  await execute(
    `INSERT INTO email_messages (id, thread_id, direction, from_address, to_address, subject, body_html, body_text, message_id, in_reply_to)
     VALUES (?, ?, 'inbound', ?, ?, ?, ?, ?, ?, ?)`,
    [
      newEmailMsgId(), threadId, correspondent, mailbox.address,
      subject.slice(0, 500) || "(no subject)",
      params.bodyHtml, params.bodyText, params.messageId, params.inReplyTo,
    ]
  );

  await execute(
    `UPDATE email_threads
     SET admin_unread = admin_unread + 1, message_count = message_count + 1,
         last_message_at = CURRENT_TIMESTAMP, status = 'open'
     WHERE id = ?`,
    [threadId]
  );

  await bumpCounter(mailbox.id, "received");
  return threadId;
}

// ─── Persistent counters ───
// Lifetime tallies that survive message/thread deletion; only Reset clears them.
async function bumpCounter(mailboxId: string, field: "sent" | "received" | "broadcast", by = 1): Promise<void> {
  if (by <= 0) return;
  await execute(
    `INSERT INTO email_counters (mailbox_id, ${field}) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE ${field} = ${field} + VALUES(${field})`,
    [mailboxId, by]
  );
}

export async function resetCounters(mailboxId?: string): Promise<void> {
  if (mailboxId) {
    await execute("UPDATE email_counters SET sent = 0, received = 0, broadcast = 0 WHERE mailbox_id = ?", [mailboxId]);
  } else {
    await execute("UPDATE email_counters SET sent = 0, received = 0, broadcast = 0");
  }
}

/** Appends an admin's outbound reply and refreshes thread recency. */
export async function recordOutbound(params: {
  threadId: string;
  mailbox: Mailbox;
  toAddress: string;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  sentBy: string | null;
}): Promise<void> {
  await execute(
    `INSERT INTO email_messages (id, thread_id, direction, from_address, to_address, subject, body_html, body_text, sent_by)
     VALUES (?, ?, 'outbound', ?, ?, ?, ?, ?, ?)`,
    [
      newEmailMsgId(), params.threadId, params.mailbox.address, params.toAddress.toLowerCase().trim(),
      params.subject.slice(0, 500) || "(no subject)", params.bodyHtml, params.bodyText, params.sentBy,
    ]
  );
  await execute(
    `UPDATE email_threads
     SET message_count = message_count + 1, last_message_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [params.threadId]
  );
  await bumpCounter(params.mailbox.id, "sent");
}

export async function listThreads(mailboxId?: string): Promise<EmailThread[]> {
  const rows = mailboxId
    ? await query<RowDataPacket[]>(
        "SELECT * FROM email_threads WHERE mailbox_id = ? ORDER BY last_message_at DESC LIMIT 200",
        [mailboxId]
      )
    : await query<RowDataPacket[]>(
        "SELECT * FROM email_threads ORDER BY last_message_at DESC LIMIT 200"
      );
  return rows as unknown as EmailThread[];
}

export async function getThread(id: string): Promise<EmailThread | null> {
  const rows = await query<RowDataPacket[]>("SELECT * FROM email_threads WHERE id = ? LIMIT 1", [id]);
  return rows.length ? (rows[0] as unknown as EmailThread) : null;
}

export async function getThreadMessages(threadId: string): Promise<EmailMessage[]> {
  const rows = await query<RowDataPacket[]>(
    "SELECT * FROM email_messages WHERE thread_id = ? ORDER BY created_at ASC",
    [threadId]
  );
  return rows as unknown as EmailMessage[];
}

export async function markThreadRead(threadId: string): Promise<void> {
  await execute("UPDATE email_threads SET admin_unread = 0 WHERE id = ?", [threadId]);
}

export async function setThreadStatus(threadId: string, status: "open" | "closed"): Promise<void> {
  await execute("UPDATE email_threads SET status = ? WHERE id = ?", [status, threadId]);
}

export async function deleteThread(threadId: string): Promise<void> {
  await execute("DELETE FROM email_threads WHERE id = ?", [threadId]);
}

/**
 * Deletes a single message from a thread and re-syncs the thread's counters.
 * If it was the thread's last message, the (now empty) thread is removed too.
 * Returns the thread id it belonged to (or null if the message didn't exist).
 */
export async function deleteMessage(messageId: string): Promise<{ threadId: string; threadDeleted: boolean } | null> {
  const rows = await query<RowDataPacket[]>(
    "SELECT thread_id FROM email_messages WHERE id = ? LIMIT 1",
    [messageId]
  );
  if (!rows.length) return null;
  const threadId = rows[0].thread_id as string;

  await execute("DELETE FROM email_messages WHERE id = ?", [messageId]);

  // Recompute the thread's message count and recency from what remains.
  const agg = await query<RowDataPacket[]>(
    "SELECT COUNT(*) AS cnt, MAX(created_at) AS last_at FROM email_messages WHERE thread_id = ?",
    [threadId]
  );
  const remaining = Number(agg[0]?.cnt) || 0;
  if (remaining === 0) {
    await execute("DELETE FROM email_threads WHERE id = ?", [threadId]);
    return { threadId, threadDeleted: true };
  }
  await execute(
    "UPDATE email_threads SET message_count = ?, last_message_at = COALESCE(?, last_message_at) WHERE id = ?",
    [remaining, agg[0]?.last_at ?? null, threadId]
  );
  return { threadId, threadDeleted: false };
}

/**
 * Dashboard counters. `sent`/`received`/`broadcast` are PERSISTENT lifetime
 * tallies read from email_counters — they survive message/thread deletion and
 * are only cleared by resetCounters(). `total` = sent + received. `unread` is
 * a live count from open threads (a state, not a tally). When mailboxId is
 * given the counters are scoped to that mailbox, else summed store-wide.
 */
export async function emailCounts(mailboxId?: string): Promise<{ sent: number; received: number; broadcast: number; total: number; unread: number }> {
  const p = mailboxId ? [mailboxId] : [];
  const cRows = await query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(sent),0) AS sent, COALESCE(SUM(received),0) AS received, COALESCE(SUM(broadcast),0) AS broadcast
     FROM email_counters ${mailboxId ? "WHERE mailbox_id = ?" : ""}`,
    p
  );
  const unreadRows = await query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(admin_unread),0) AS unread FROM email_threads ${mailboxId ? "WHERE mailbox_id = ?" : ""}`,
    p
  );
  const sent = Number(cRows[0]?.sent) || 0;
  const received = Number(cRows[0]?.received) || 0;
  return {
    sent,
    received,
    broadcast: Number(cRows[0]?.broadcast) || 0,
    total: sent + received,
    unread: Number(unreadRows[0]?.unread) || 0,
  };
}

export async function createMailbox(m: {
  address: string; display_name: string; can_receive: boolean; can_send: boolean; can_broadcast: boolean;
}): Promise<Mailbox> {
  const id = newMailboxId();
  await execute(
    `INSERT INTO email_mailboxes (id, address, display_name, is_active, can_receive, can_send, can_broadcast)
     VALUES (?, ?, ?, TRUE, ?, ?, ?)`,
    [id, m.address.toLowerCase().trim(), m.display_name.trim(), m.can_receive, m.can_send, m.can_broadcast]
  );
  return (await getMailbox(id))!;
}

export async function updateMailbox(id: string, fields: Partial<Pick<Mailbox, "display_name" | "is_active" | "can_receive" | "can_send" | "can_broadcast">>): Promise<void> {
  const sets: string[] = [];
  const vals: (string | number | boolean | null)[] = [];
  if (fields.display_name !== undefined) { sets.push("display_name = ?"); vals.push(fields.display_name.trim()); }
  if (fields.is_active !== undefined) { sets.push("is_active = ?"); vals.push(fields.is_active); }
  if (fields.can_receive !== undefined) { sets.push("can_receive = ?"); vals.push(fields.can_receive); }
  if (fields.can_send !== undefined) { sets.push("can_send = ?"); vals.push(fields.can_send); }
  if (fields.can_broadcast !== undefined) { sets.push("can_broadcast = ?"); vals.push(fields.can_broadcast); }
  if (!sets.length) return;
  vals.push(id);
  await execute(`UPDATE email_mailboxes SET ${sets.join(", ")} WHERE id = ?`, vals);
}

export async function deleteMailbox(id: string): Promise<ResultSetHeader> {
  return execute("DELETE FROM email_mailboxes WHERE id = ?", [id]);
}

// ─── Drafts ───
export interface EmailDraft {
  id: string;
  kind: "reply" | "broadcast";
  mailbox_id: string | null;
  thread_id: string | null;
  from_address: string | null;
  to_address: string | null;
  subject: string;
  body_text: string | null;
  segment: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftInput {
  kind: "reply" | "broadcast";
  mailbox_id: string | null;
  thread_id?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  subject: string;
  body_text: string | null;
  segment?: unknown;
  created_by: string | null;
}

function toDraft(r: RowDataPacket): EmailDraft {
  let segment: unknown = null;
  if (r.segment != null) {
    if (typeof r.segment === "string") { try { segment = JSON.parse(r.segment); } catch { segment = null; } }
    else segment = r.segment;
  }
  return {
    id: r.id, kind: r.kind, mailbox_id: r.mailbox_id, thread_id: r.thread_id,
    from_address: r.from_address, to_address: r.to_address, subject: r.subject,
    body_text: r.body_text, segment, created_by: r.created_by,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

export async function listDrafts(): Promise<EmailDraft[]> {
  const rows = await query<RowDataPacket[]>("SELECT * FROM email_drafts ORDER BY updated_at DESC LIMIT 200");
  return rows.map(toDraft);
}

export async function getDraft(id: string): Promise<EmailDraft | null> {
  const rows = await query<RowDataPacket[]>("SELECT * FROM email_drafts WHERE id = ? LIMIT 1", [id]);
  return rows.length ? toDraft(rows[0]) : null;
}

export async function createDraft(d: DraftInput): Promise<EmailDraft> {
  const id = newDraftId();
  await execute(
    `INSERT INTO email_drafts (id, kind, mailbox_id, thread_id, from_address, to_address, subject, body_text, segment, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, d.kind, d.mailbox_id, d.thread_id ?? null, d.from_address ?? null, d.to_address ?? null,
      (d.subject || "(no subject)").slice(0, 500), d.body_text ?? null,
      d.segment != null ? JSON.stringify(d.segment) : null, d.created_by,
    ]
  );
  return (await getDraft(id))!;
}

export async function updateDraft(id: string, d: Partial<DraftInput>): Promise<void> {
  const sets: string[] = [];
  const vals: (string | number | boolean | null)[] = [];
  if (d.mailbox_id !== undefined) { sets.push("mailbox_id = ?"); vals.push(d.mailbox_id); }
  if (d.to_address !== undefined) { sets.push("to_address = ?"); vals.push(d.to_address ?? null); }
  if (d.subject !== undefined) { sets.push("subject = ?"); vals.push((d.subject || "(no subject)").slice(0, 500)); }
  if (d.body_text !== undefined) { sets.push("body_text = ?"); vals.push(d.body_text ?? null); }
  if (d.segment !== undefined) { sets.push("segment = ?"); vals.push(d.segment != null ? JSON.stringify(d.segment) : null); }
  if (!sets.length) return;
  vals.push(id);
  await execute(`UPDATE email_drafts SET ${sets.join(", ")} WHERE id = ?`, vals);
}

export async function deleteDraft(id: string): Promise<void> {
  await execute("DELETE FROM email_drafts WHERE id = ?", [id]);
}

export async function recordBroadcast(b: {
  mailbox: Mailbox; subject: string; bodyHtml: string; segment: unknown;
  recipientCount: number; sentCount: number; failedCount: number; sentBy: string | null;
}): Promise<void> {
  await execute(
    `INSERT INTO email_broadcasts (id, mailbox_id, from_address, subject, body_html, segment, recipient_count, sent_count, failed_count, status, sent_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newBroadcastId(), b.mailbox.id, b.mailbox.address, b.subject.slice(0, 500),
      b.bodyHtml, JSON.stringify(b.segment ?? null),
      b.recipientCount, b.sentCount, b.failedCount,
      b.failedCount > 0 && b.sentCount === 0 ? "failed" : "sent", b.sentBy,
    ]
  );
  // A broadcast counts toward both the lifetime "broadcast" tally and "sent".
  await bumpCounter(b.mailbox.id, "broadcast", b.sentCount);
  await bumpCounter(b.mailbox.id, "sent", b.sentCount);
}
