import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// URL redirects managed from admin → SEO Management → Redirects. Matching
// happens in the root catch-all route (src/app/[...slug]/page.tsx), which
// Next only reaches when no real route matched — so a redirect can rescue an
// old/dead URL but can never shadow a live page.

let migrated = false;
export async function ensureRedirectsTable() {
  if (migrated) return;
  try {
    await execute(`CREATE TABLE IF NOT EXISTS redirects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      from_path VARCHAR(500) NOT NULL UNIQUE,
      to_path VARCHAR(500) NOT NULL,
      redirect_type INT NOT NULL DEFAULT 301,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      hit_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    migrated = true;
  } catch (err) {
    console.error("[ensureRedirectsTable] migration failed:", err);
  }
}

/** Normalize a path for storage/matching: leading slash, no trailing slash (except root). */
export function normalizePath(raw: string): string {
  let p = raw.trim();
  // Tolerate a pasted full URL — only the path part matters for matching.
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch {}
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

export interface RedirectRow {
  id: number;
  from_path: string;
  to_path: string;
  redirect_type: number;
  is_active: boolean;
  hit_count: number;
  created_at: string;
}

export async function getRedirectForPath(path: string): Promise<{ to: string; type: 301 | 302 } | null> {
  try {
    await ensureRedirectsTable();
    const rows = await query<RowDataPacket[]>(
      "SELECT id, to_path, redirect_type FROM redirects WHERE from_path = ? AND is_active = 1 LIMIT 1",
      [normalizePath(path)]
    );
    if (rows.length === 0) return null;
    // Fire-and-forget hit counter — observability only, never blocks the redirect.
    execute("UPDATE redirects SET hit_count = hit_count + 1 WHERE id = ?", [rows[0].id]).catch(() => {});
    return { to: rows[0].to_path as string, type: rows[0].redirect_type === 302 ? 302 : 301 };
  } catch {
    return null;
  }
}
