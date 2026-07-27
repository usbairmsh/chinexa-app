import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

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

async function ensureColumn(table: string, column: string, definition: string) {
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  if (Number(rows[0]?.c) > 0) return;
  await execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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
        status ENUM('open','closed') NOT NULL DEFAULT 'open',
        admin_unread INT NOT NULL DEFAULT 0,
        message_count INT NOT NULL DEFAULT 0,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_mailbox_recent (mailbox_id, last_message_at),
        INDEX idx_correspondent (mailbox_id, correspondent),
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

    // Future-proofing hook for adding columns to older deployments.
    await ensureColumn("email_mailboxes", "can_broadcast", "BOOLEAN NOT NULL DEFAULT FALSE");

    ensured = true;
  } catch (err) {
    console.error("[ensureEmailInboxTables] migration failed:", err);
    // Leave ensured=false so a transient failure is retried next call.
  }
}
