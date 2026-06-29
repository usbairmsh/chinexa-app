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
    queueLimit: 0,
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
