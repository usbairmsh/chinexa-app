import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { publicServerError } from "@/lib/validate";
import { requirePermission } from "@/lib/admin-permissions-server";
import { ensureTagTables } from "@/lib/migrate-tags";
import {
  getTags, slugify, isValidSlug, parseTagBody,
} from "@/lib/tags";

export const dynamic = "force-dynamic";

// GET /api/tags — public: the storefront needs colours to render chips.
// Returns every field; none of them are secret.
export async function GET(req: NextRequest) {
  try {
    const activeOnly = new URL(req.url).searchParams.get("active") === "true";
    return NextResponse.json(await getTags({ activeOnly }));
  } catch (error: unknown) {
    return publicServerError("GET /api/tags", error);
  }
}

// POST /api/tags — create a custom tag.
export async function POST(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "tags", "add");
    if (denied) return denied;
    await ensureTagTables();

    const body = await req.json().catch(() => ({}));
    const parsed = parseTagBody(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    // Slug is derived from the name unless one was given explicitly. It ends up
    // inside products.badges and inside LIKE patterns, so it must be clean.
    const slug = slugify(String(body.slug ?? "").trim() || parsed.label);
    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: "That tag name doesn't produce a usable slug — use letters or numbers." }, { status: 400 });
    }

    const clash = await query<RowDataPacket[]>("SELECT id FROM tags WHERE slug = ? LIMIT 1", [slug]);
    if (clash.length > 0) {
      return NextResponse.json({ error: `A tag with the slug "${slug}" already exists.` }, { status: 409 });
    }

    const id = `tag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await execute(
      `INSERT INTO tags (id, slug, label, color, text_color, is_system, attach_type, attach_ids,
                         validity_mode, validity_value, is_active, priority)
       VALUES (?, ?, ?, ?, ?, FALSE, ?, ?, ?, ?, ?, ?)`,
      [
        id, slug, parsed.label, parsed.color, parsed.textColor,
        parsed.attachType, JSON.stringify(parsed.attachIds),
        parsed.validityMode, parsed.validityValue, parsed.isActive, parsed.priority,
      ]
    );

    await logActivity("create", "tags", id, `Created tag "${parsed.label}"`).catch(() => {});
    const rows = await query<RowDataPacket[]>("SELECT * FROM tags WHERE id = ? LIMIT 1", [id]);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: unknown) {
    return publicServerError("POST /api/tags", error);
  }
}

// PUT /api/tags — bulk reorder. Body: { order: ["tag-id-1", "tag-id-2", ...] }
// Priority decides which three tags a product card shows, so reordering is a
// first-class operation rather than editing each tag one at a time.
export async function PUT(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "tags", "edit");
    if (denied) return denied;
    await ensureTagTables();

    const body = await req.json().catch(() => ({}));
    const order = Array.isArray(body.order) ? body.order.map((v: unknown) => String(v)) : null;
    if (!order || order.length === 0) {
      return NextResponse.json({ error: "Send the tag ids in their new order." }, { status: 400 });
    }

    // Spaced by 10 so a single tag can later be nudged between two others
    // without renumbering the whole list.
    for (let i = 0; i < order.length; i++) {
      await execute("UPDATE tags SET priority = ? WHERE id = ?", [(i + 1) * 10, order[i]]);
    }

    await logActivity("update", "tags", undefined, `Reordered ${order.length} tags`).catch(() => {});
    return NextResponse.json(await getTags());
  } catch (error: unknown) {
    return publicServerError("PUT /api/tags", error);
  }
}
