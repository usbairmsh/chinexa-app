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

// ─── Request-body parsing ───────────────────────────────────────────────
// Shared by POST /api/tags and PATCH /api/tags/[id] so a tag created one way
// can never be validated differently from one edited the other way.
