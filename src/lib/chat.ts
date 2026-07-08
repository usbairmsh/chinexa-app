import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";

async function ensureColumn(table: string, column: string, definition: string) {
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  if (Number(rows[0]?.c) > 0) return;
  await execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

let tablesEnsured = false;

/** Self-healing: create the chat tables on DBs that predate this feature. */
export async function ensureChatTables() {
  if (tablesEnsured) return;
  try {
    await execute(
      `CREATE TABLE IF NOT EXISTS chat_conversations (
        id VARCHAR(50) PRIMARY KEY,
        customer_id VARCHAR(50) NULL,
        guest_id VARCHAR(50) NULL,
        display_name VARCHAR(150) NOT NULL,
        status ENUM('open', 'closed') DEFAULT 'open',
        customer_unread INT DEFAULT 0,
        admin_unread INT DEFAULT 0,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_customer (customer_id),
        UNIQUE KEY uniq_guest (guest_id),
        INDEX idx_last_message (last_message_at)
      ) ENGINE=InnoDB`
    );
    await execute(
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(50) PRIMARY KEY,
        conversation_id VARCHAR(50) NOT NULL,
        sender_type ENUM('customer', 'admin') NOT NULL,
        sender_label VARCHAR(150),
        flag ENUM('general', 'help_and_support') DEFAULT 'general',
        body TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_conversation (conversation_id, created_at),
        FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB`
    );
    await ensureColumn("chat_messages", "read_at", "TIMESTAMP NULL");
    tablesEnsured = true;
  } catch (err) {
    console.error("[ensureChatTables] failed:", err);
  }
}

let rid = 0;
function chatId(prefix: string): string {
  return `${prefix}-${Date.now()}-${(rid = (rid + 1) % 10000)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newConversationId(): string {
  return chatId("conv");
}

export function newMessageId(): string {
  return chatId("msg");
}
