import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensureTagTables } from "@/lib/migrate-tags";
import { parseJsonArray, type Tag, type TagAttachType, type TagValidityMode } from "@/lib/tags";

// ─── Tag reads (server only) ─────────────────────────────────────────
// Split out of lib/tags.ts because that module is imported by client
// components (the admin configurator needs the colour + validity helpers).
// Importing the mysql2 pool from a client component pulls node:net into the
// browser bundle and fails the build, so anything touching the DB lives here.

function rowToTag(r: RowDataPacket): Tag {
  return {
    id: String(r.id),
    slug: String(r.slug),
    label: String(r.label),
    color: String(r.color),
    text_color: r.text_color ? String(r.text_color) : null,
    is_system: Boolean(r.is_system),
    attach_type: String(r.attach_type) as TagAttachType,
    attach_ids: parseJsonArray(r.attach_ids),
    validity_mode: String(r.validity_mode) as TagValidityMode,
    validity_value: r.validity_value ? String(r.validity_value) : null,
    is_active: Boolean(r.is_active),
    priority: Number(r.priority) || 0,
  };
}

/** Every tag, highest priority first. */
export async function getTags(opts: { activeOnly?: boolean } = {}): Promise<Tag[]> {
  await ensureTagTables();
  const rows = await query<RowDataPacket[]>(
    `SELECT * FROM tags ${opts.activeOnly ? "WHERE is_active = TRUE" : ""} ORDER BY priority ASC, label ASC`
  );
  return rows.map(rowToTag);
}

export async function getTagBySlug(slug: string): Promise<Tag | null> {
  await ensureTagTables();
  const rows = await query<RowDataPacket[]>("SELECT * FROM tags WHERE slug = ? LIMIT 1", [slug]);
  return rows.length ? rowToTag(rows[0]) : null;
}

// ─── Application timestamps ───────────────────────────────────────────────────

/**
 * Merge a product's new tag list into its badge_applied_at map.
 *
 * A slug that is NEWLY present gets stamped with now; one that is still present
 * keeps its original stamp (so editing an unrelated field doesn't silently
 * restart a countdown); one that has gone is dropped.
 *
 * This is what makes "validity counted from the date I added the tag to the
 * product" work — the same tag expires on a different day for each product.
 */
export function mergeAppliedAt(
  existing: unknown,
  nextSlugs: string[],
  now: Date = new Date()
): Record<string, string> {
  let prev: Record<string, string> = {};
  try {
    const raw = typeof existing === "string" ? JSON.parse(existing) : existing;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) prev = raw as Record<string, string>;
  } catch {
    // Unparseable — treat as empty rather than throwing away the save.
  }
  const stamp = now.toISOString();
  const out: Record<string, string> = {};
  for (const slug of nextSlugs) {
    out[slug] = prev[slug] || stamp;
  }
  return out;
}
