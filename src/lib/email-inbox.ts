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

  // Prefer threading onto the correspondent's most recent open thread in this
  // mailbox; fall back to a new thread. (Header-based matching could be added
  // here by looking up in_reply_to against email_messages.message_id.)
  const existing = await query<RowDataPacket[]>(
    `SELECT id FROM email_threads
     WHERE mailbox_id = ? AND correspondent = ? AND status = 'open'
     ORDER BY last_message_at DESC LIMIT 1`,
    [mailbox.id, correspondent]
  );

  let threadId: string;
  if (existing.length) {
    threadId = existing[0].id as string;
  } else {
    threadId = newThreadId();
    await execute(
      `INSERT INTO email_threads (id, mailbox_id, correspondent, correspondent_name, subject, status, admin_unread, message_count, last_message_at)
       VALUES (?, ?, ?, ?, ?, 'open', 0, 0, CURRENT_TIMESTAMP)`,
      [threadId, mailbox.id, correspondent, params.fromName || null, subject.slice(0, 500) || "(no subject)"]
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

  return threadId;
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
 * Dashboard counters. `sent`/`received` count individual messages (inbound vs
 * outbound), `total` is their sum. Broadcast sends count toward `sent`. When
 * mailboxId is given the counts are scoped to that mailbox, else store-wide.
 */
export async function emailCounts(mailboxId?: string): Promise<{ sent: number; received: number; broadcast: number; total: number; unread: number }> {
  const where = mailboxId ? "WHERE t.mailbox_id = ?" : "";
  const p = mailboxId ? [mailboxId] : [];
  const msgRows = await query<RowDataPacket[]>(
    `SELECT
       SUM(m.direction = 'outbound') AS sent,
       SUM(m.direction = 'inbound')  AS received,
       COUNT(*) AS total
     FROM email_messages m
     JOIN email_threads t ON t.id = m.thread_id
     ${where}`,
    p
  );
  const unreadRows = await query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(admin_unread),0) AS unread FROM email_threads ${mailboxId ? "WHERE mailbox_id = ?" : ""}`,
    p
  );
  const bcRows = await query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(sent_count),0) AS broadcast FROM email_broadcasts ${mailboxId ? "WHERE mailbox_id = ?" : ""}`,
    p
  );
  const sent = Number(msgRows[0]?.sent) || 0;
  const received = Number(msgRows[0]?.received) || 0;
  const total = Number(msgRows[0]?.total) || 0;
  return {
    sent,
    received,
    broadcast: Number(bcRows[0]?.broadcast) || 0,
    total,
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
}
