import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";

// Cache the pool on globalThis so HMR / dev reloads don't leak connections
const globalForDb = globalThis as unknown as { __dbPool?: Pool };

const pool: Pool =
  globalForDb.__dbPool ??
  mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "chinexa",
    waitForConnections: true,
    connectionLimit: 10,
    // Bounded, not 0 (unbounded) — a burst of concurrent requests past the
    // connection limit now fails fast with a clear error past 50 queued
    // requests instead of piling up in memory indefinitely under load.
    queueLimit: 50,
    // Neither was previously set: a connection can silently go stale (VPS/
    // Docker NAT dropping an idle TCP socket) while the pool still thinks
    // it's live, surfacing as an ECONNRESET/PROTOCOL_CONNECTION_LOST on the
    // next query. keepAlive pings the connection so idle-reap is far less
    // likely; connectTimeout stops a genuinely wedged connection attempt
    // from hanging a request indefinitely instead of failing within 10s.
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__dbPool = pool;
}

export default pool;

export async function query<T extends RowDataPacket[] = RowDataPacket[]>(
  sql: string,
  params?: (string | number | boolean | null)[]
): Promise<T> {
  const [rows] = await pool.execute<T>(sql, params);
  return rows;
}

export async function execute(
  sql: string,
  params?: (string | number | boolean | null)[]
): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result;
}

/** Escape LIKE wildcard characters in user search input */
export function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

/**
 * Read a JSON value off a DB row regardless of column type. mysql2
 * auto-parses JSON-typed columns into objects, while TEXT columns holding
 * JSON come back as strings — and which one a deployment actually has can
 * vary with the schema's age. Calling JSON.parse() unconditionally was the
 * classic trap here: on a real JSON column it received an object, coerced it
 * to "[object Object]", threw, and the catch silently discarded the data
 * (roles/admin permissions reading back empty).
 */
export function parseDbJson(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return typeof raw === "object" ? raw : null;
}
