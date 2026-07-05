import { query, execute } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

export type NotificationType = "order" | "promo" | "loyalty" | "system";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
}

let rid = 0;
function notifId(): string {
  // Date.now + counter + random — collision-safe within a burst of bulk inserts
  return `notif-${Date.now()}-${(rid = (rid + 1) % 10000)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Self-healing: create the notifications table on DBs that predate it ───
let tablesEnsured = false;
export async function ensureNotificationTables() {
  if (tablesEnsured) return;
  try {
    await execute(
      `CREATE TABLE IF NOT EXISTS customer_notifications (
        id VARCHAR(50) PRIMARY KEY,
        customer_id VARCHAR(50) NOT NULL,
        type ENUM('order', 'promo', 'loyalty', 'system') DEFAULT 'system',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(500),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_customer_read (customer_id, is_read)
      ) ENGINE=InnoDB`
    );
    tablesEnsured = true;
  } catch (err) {
    console.error("[ensureNotificationTables] failed:", err);
  }
}

// ─── Admin incoming notifications (new orders, returns, reviews, stock, fraud) ───
export type AdminNotificationType = "order" | "return" | "review" | "stock" | "fraud" | "customer" | "system";

let adminTableEnsured = false;
export async function ensureAdminNotificationTable() {
  if (adminTableEnsured) return;
  try {
    await execute(
      `CREATE TABLE IF NOT EXISTS admin_notifications (
        id VARCHAR(50) PRIMARY KEY,
        type VARCHAR(20) DEFAULT 'system',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(500),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_read_created (is_read, created_at)
      ) ENGINE=InnoDB`
    );
    adminTableEnsured = true;
  } catch (err) {
    console.error("[ensureAdminNotificationTable] failed:", err);
  }
}

/** Notify the admin panel about a store event. Never throws — safe to call inline. */
export async function notifyAdmin(
  type: AdminNotificationType,
  title: string,
  message: string,
  link?: string | null
): Promise<void> {
  try {
    await ensureAdminNotificationTable();
    await execute(
      "INSERT INTO admin_notifications (id, type, title, message, link) VALUES (?, ?, ?, ?, ?)",
      [notifId().replace("notif-", "anotif-"), type, title, message, link || null]
    );
  } catch (err) {
    console.error("[notifyAdmin] failed:", err);
  }
}

/** Insert the same notification for many customers (chunked multi-row INSERT). */
export async function bulkNotify(customerIds: string[], payload: NotificationPayload): Promise<number> {
  await ensureNotificationTables();
  const ids = [...new Set(customerIds)].filter(Boolean);
  if (ids.length === 0) return 0;
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
    const values: (string | null)[] = [];
    for (const cid of chunk) {
      values.push(notifId(), cid, payload.type, payload.title, payload.message, payload.link || null);
    }
    await execute(
      `INSERT INTO customer_notifications (id, customer_id, type, title, message, link) VALUES ${placeholders}`,
      values
    );
  }
  return ids.length;
}

/** All active customer ids. */
export async function getAllCustomerIds(): Promise<string[]> {
  const rows = await query<RowDataPacket[]>("SELECT id FROM customers WHERE is_active = 1");
  return rows.map((r) => r.id as string);
}

/**
 * Customer ids belonging to the given membership tiers.
 * Accepts tier ids OR tier names (admin UIs have stored both historically).
 */
export async function getTierCustomerIds(tierKeys: string[]): Promise<string[]> {
  if (tierKeys.length === 0) return [];
  const placeholders = tierKeys.map(() => "?").join(",");
  const tiers = await query<RowDataPacket[]>(
    `SELECT id, name, min_points, max_points FROM membership_tiers
     WHERE is_active = 1 AND (id IN (${placeholders}) OR name IN (${placeholders}))`,
    [...tierKeys, ...tierKeys]
  );
  if (tiers.length === 0) return [];

  const result = new Set<string>();
  for (const tier of tiers) {
    const rows = await query<RowDataPacket[]>(
      `SELECT c.id FROM customers c
       LEFT JOIN customer_points p ON p.customer_id = c.id
       WHERE c.is_active = 1
       GROUP BY c.id
       HAVING COALESCE(SUM(p.points), 0) BETWEEN ? AND ?`,
      [Number(tier.min_points) || 0, Number(tier.max_points) || 0]
    );
    for (const r of rows) result.add(r.id as string);
  }
  return [...result];
}

/**
 * Resolve which customers should hear about a promotion, given its
 * applicability (same model offers and coupons use).
 * Product/category-scoped promos are announced to everyone — they apply to
 * items, not people. Customer/tier-scoped promos go only to those people.
 */
export async function resolvePromoRecipients(
  applicability: string | null | undefined,
  applicableIds: string[]
): Promise<string[]> {
  switch (applicability) {
    case "customers":
      return applicableIds;
    case "tiers":
      return getTierCustomerIds(applicableIds);
    default:
      // store, categories, subcategories, products — everyone can use it
      return getAllCustomerIds();
  }
}

/**
 * After a points balance change, notify the customer if they crossed into a
 * higher membership tier. Compares tier at prevPoints vs newPoints.
 */
export async function notifyTierUpgrade(customerId: string, prevPoints: number, newPoints: number): Promise<void> {
  if (newPoints <= prevPoints) return; // only upgrades on gains
  const tiers = await query<RowDataPacket[]>(
    "SELECT name, min_points, max_points FROM membership_tiers WHERE is_active = 1 ORDER BY min_points ASC"
  );
  const tierAt = (pts: number) =>
    tiers.find((t) => pts >= Number(t.min_points) && pts <= Number(t.max_points)) || null;

  const prevTier = tierAt(prevPoints);
  const newTier = tierAt(newPoints);
  if (!newTier) return;
  if (prevTier && prevTier.name === newTier.name) return;
  if (prevTier && Number(newTier.min_points) <= Number(prevTier.min_points)) return; // not an upgrade

  await bulkNotify([customerId], {
    type: "loyalty",
    title: `You've been upgraded to ${newTier.name}! 🎉`,
    message: `Congratulations! Your loyalty points reached ${newPoints.toLocaleString("en-BD")} and you are now a ${newTier.name} member. Enjoy your new tier benefits.`,
    link: "/dashboard",
  });
}
