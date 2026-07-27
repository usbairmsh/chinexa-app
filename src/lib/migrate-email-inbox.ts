import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { normalizeSubject as normSubjectSql } from "@/lib/email-inbox";

// Self-healing schema for the configurable multi-mailbox Email Center. Mirrors
// the chat/roles migration pattern: CREATE TABLE IF NOT EXISTS is idempotent,
// and ensureColumn() lets us add columns to already-provisioned DBs later.
//
// Model:
//   email_mailboxes  — the admin-configurable receiving addresses (support@,
//                      info@, store@, a no-reply broadcast sender, …). Adding a
//                      mailbox is a row here — no DNS/deploy per address, since
//                      the inbound webhook matches the recipient against this
//                      table (unmatched mail is dropped).
//   email_threads    — one conversation per (mailbox × external correspondent).
//                      Carries mailbox_id so per-mailbox access can be layered
//                      on later without a schema change.
//   email_messages   — every message in a thread, inbound or outbound.
//   email_broadcasts — audit of no-reply segment sends.

/** Adds the column if missing. Returns true when it was actually added (so the
 *  caller can run a one-time backfill), false if it already existed. */
async function ensureColumn(table: string, column: string, definition: string): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  if (Number(rows[0]?.c) > 0) return false;
  await execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table]
  );
  return Number(rows[0]?.c) > 0;
}

let ensured = false;

export async function ensureEmailInboxTables() {
  if (ensured) return;
  try {
    await execute(
      `CREATE TABLE IF NOT EXISTS email_mailboxes (
        id VARCHAR(50) PRIMARY KEY,
        address VARCHAR(255) NOT NULL UNIQUE,
        display_name VARCHAR(150) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        can_receive BOOLEAN NOT NULL DEFAULT TRUE,
        can_send BOOLEAN NOT NULL DEFAULT TRUE,
        can_broadcast BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB`
    );

    await execute(
      `CREATE TABLE IF NOT EXISTS email_threads (
        id VARCHAR(50) PRIMARY KEY,
        mailbox_id VARCHAR(50) NOT NULL,
        correspondent VARCHAR(255) NOT NULL,
        correspondent_name VARCHAR(255) NULL,
        subject VARCHAR(500) NOT NULL DEFAULT '(no subject)',
        norm_subject VARCHAR(255) NOT NULL DEFAULT '(no subject)',
        status ENUM('open','closed') NOT NULL DEFAULT 'open',
        admin_unread INT NOT NULL DEFAULT 0,
        message_count INT NOT NULL DEFAULT 0,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_mailbox_recent (mailbox_id, last_message_at),
        INDEX idx_correspondent (mailbox_id, correspondent),
        INDEX idx_thread_match (mailbox_id, correspondent, norm_subject, status),
        FOREIGN KEY (mailbox_id) REFERENCES email_mailboxes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB`
    );

    await execute(
      `CREATE TABLE IF NOT EXISTS email_messages (
        id VARCHAR(50) PRIMARY KEY,
        thread_id VARCHAR(50) NOT NULL,
        direction ENUM('inbound','outbound') NOT NULL,
        from_address VARCHAR(255) NOT NULL,
        to_address VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL DEFAULT '(no subject)',
        body_html MEDIUMTEXT NULL,
        body_text MEDIUMTEXT NULL,
        message_id VARCHAR(255) NULL,
        in_reply_to VARCHAR(255) NULL,
        sent_by VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_thread (thread_id, created_at),
        FOREIGN KEY (thread_id) REFERENCES email_threads(id) ON DELETE CASCADE
      ) ENGINE=InnoDB`
    );

    await execute(
      `CREATE TABLE IF NOT EXISTS email_broadcasts (
        id VARCHAR(50) PRIMARY KEY,
        mailbox_id VARCHAR(50) NULL,
        from_address VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        body_html MEDIUMTEXT NULL,
        segment JSON NULL,
        recipient_count INT NOT NULL DEFAULT 0,
        sent_count INT NOT NULL DEFAULT 0,
        failed_count INT NOT NULL DEFAULT 0,
        status ENUM('sending','sent','failed') NOT NULL DEFAULT 'sending',
        sent_by VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB`
    );

    // Persistent lifetime tallies — incremented on every send/receive and only
    // cleared by an explicit admin Reset. Kept separate from email_messages so
    // deleting a message never changes the totals. One row per mailbox.
    const countersExisted = await tableExists("email_counters");
    await execute(
      `CREATE TABLE IF NOT EXISTS email_counters (
        mailbox_id VARCHAR(50) PRIMARY KEY,
        sent BIGINT NOT NULL DEFAULT 0,
        received BIGINT NOT NULL DEFAULT 0,
        broadcast BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`
    );
    // First creation: seed the tallies from whatever messages/broadcasts already
    // exist, so the counts don't reset to zero on deployments that predate this
    // table. (email_threads/messages may themselves not exist yet on a brand-new
    // DB — the queries are guarded to no-op in that case.)
    if (!countersExisted && (await tableExists("email_messages"))) {
      await execute(
        `INSERT INTO email_counters (mailbox_id, sent, received)
         SELECT t.mailbox_id,
                SUM(m.direction = 'outbound') AS sent,
                SUM(m.direction = 'inbound')  AS received
         FROM email_messages m JOIN email_threads t ON t.id = m.thread_id
         GROUP BY t.mailbox_id
         ON DUPLICATE KEY UPDATE sent = VALUES(sent), received = VALUES(received)`
      );
      if (await tableExists("email_broadcasts")) {
        await execute(
          `INSERT INTO email_counters (mailbox_id, broadcast)
           SELECT mailbox_id, COALESCE(SUM(sent_count),0) FROM email_broadcasts
           WHERE mailbox_id IS NOT NULL GROUP BY mailbox_id
           ON DUPLICATE KEY UPDATE broadcast = VALUES(broadcast)`
        );
      }
    }

    await execute(
      `CREATE TABLE IF NOT EXISTS email_drafts (
        id VARCHAR(50) PRIMARY KEY,
        kind ENUM('reply','broadcast') NOT NULL DEFAULT 'reply',
        mailbox_id VARCHAR(50) NULL,
        thread_id VARCHAR(50) NULL,
        from_address VARCHAR(255) NULL,
        to_address VARCHAR(255) NULL,
        subject VARCHAR(500) NOT NULL DEFAULT '(no subject)',
        body_text MEDIUMTEXT NULL,
        segment JSON NULL,
        created_by VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_kind_recent (kind, updated_at),
        INDEX idx_thread (thread_id)
      ) ENGINE=InnoDB`
    );

    // Attachments — for both outgoing (staged on a draft/compose, then linked to
    // the sent message) and incoming (parsed from inbound webhook). Stored on
    // disk under public/uploads/email; `url` is the API-served path.
    await execute(
      `CREATE TABLE IF NOT EXISTS email_attachments (
        id VARCHAR(50) PRIMARY KEY,
        message_id VARCHAR(50) NULL,
        draft_id VARCHAR(50) NULL,
        compose_token VARCHAR(80) NULL,
        direction ENUM('inbound','outbound') NOT NULL DEFAULT 'outbound',
        filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(150) NOT NULL DEFAULT 'application/octet-stream',
        size INT NOT NULL DEFAULT 0,
        url VARCHAR(500) NOT NULL,
        is_inline BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_message (message_id),
        INDEX idx_draft (draft_id),
        INDEX idx_compose (compose_token)
      ) ENGINE=InnoDB`
    );

    // Future-proofing hook for adding columns to older deployments.
    await ensureColumn("email_mailboxes", "can_broadcast", "BOOLEAN NOT NULL DEFAULT FALSE");
    // is_inline marks attachments that are embedded in the email body (inline
    // images) rather than sent as separate file attachments — tracked so the
    // orphan-cleanup can delete them if the compose is abandoned.
    await ensureColumn("email_attachments", "is_inline", "BOOLEAN NOT NULL DEFAULT FALSE");
    // norm_subject drives thread matching (reply vs new email). On DBs created
    // before this column existed, add it then backfill from the stored subject
    // (Re:/Fwd: stripped, lowercased) so existing threads still match their own
    // replies instead of all collapsing onto the '(no subject)' default.
    const addedNormSubject = await ensureColumn("email_threads", "norm_subject", "VARCHAR(255) NOT NULL DEFAULT '(no subject)'");
    if (addedNormSubject) {
      // Backfill existing threads from the JS-normalized subject (avoids relying
      // on REGEXP_REPLACE, which is MySQL 8+ only). Chunked, keyed by id.
      const rows = await query<RowDataPacket[]>("SELECT id, subject FROM email_threads");
      for (const r of rows) {
        await execute("UPDATE email_threads SET norm_subject = ? WHERE id = ?", [
          normSubjectSql(String(r.subject || "")), r.id,
        ]);
      }
    }

    ensured = true;
  } catch (err) {
    console.error("[ensureEmailInboxTables] migration failed:", err);
    // Leave ensured=false so a transient failure is retried next call.
  }
}
