import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { publicServerError } from "@/lib/validate";
import { requirePermission } from "@/lib/admin-permissions-server";
import { ensureTagTables } from "@/lib/migrate-tags";
import { parseTagBody, parseJsonArray } from "@/lib/tags";

export const dynamic = "force-dynamic";

async function loadTag(id: string): Promise<RowDataPacket | null> {
  const rows = await query<RowDataPacket[]>("SELECT * FROM tags WHERE id = ? LIMIT 1", [id]);
  return rows.length ? rows[0] : null;
}

// GET /api/tags/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureTagTables();
    const { id } = await params;
    const tag = await loadTag(id);
    if (!tag) return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    return NextResponse.json(tag);
  } catch (error: unknown) {
    return publicServerError("GET /api/tags/[id]", error);
  }
}

// PATCH /api/tags/[id] — edit a tag.
//
// A SYSTEM tag (the seven built-ins) can be recoloured, relabelled, reprioritised
// and attached, but its SLUG is frozen: the slug is what sits in products.badges
// and in the queries behind /collections/*, /exclusive and the pre-order rules,
// so renaming it would silently empty a storefront page or change checkout
// behaviour.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "tags", "edit");
    if (denied) return denied;
    await ensureTagTables();

    const { id } = await params;
    const existing = await loadTag(id);
    if (!existing) return NextResponse.json({ error: "Tag not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const parsed = parseTagBody(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    // Slug changes are rejected outright for system tags, rather than silently
    // ignored — an admin who tried needs to know it didn't happen.
    if (body.slug !== undefined && Boolean(existing.is_system)) {
      const requested = String(body.slug).trim();
      if (requested && requested !== String(existing.slug)) {
        return NextResponse.json(
          { error: `"${existing.label}" is a built-in tag, so its slug can't be changed. You can still rename, recolour and reorder it.` },
          { status: 409 }
        );
      }
    }

    // A system tag must stay usable: deactivating preorder would break the
    // out-of-stock flow, so is_active is pinned true for built-ins.
    const isActive = Boolean(existing.is_system) ? true : parsed.isActive;

    await execute(
      `UPDATE tags SET label = ?, color = ?, text_color = ?, attach_type = ?, attach_ids = ?,
              validity_mode = ?, validity_value = ?, is_active = ?, priority = ?
       WHERE id = ?`,
      [
        parsed.label, parsed.color, parsed.textColor,
        parsed.attachType, JSON.stringify(parsed.attachIds),
        parsed.validityMode, parsed.validityValue, isActive, parsed.priority, id,
      ]
    );

    await logActivity("update", "tags", id, `Updated tag "${parsed.label}"`).catch(() => {});
    return NextResponse.json(await loadTag(id));
  } catch (error: unknown) {
    return publicServerError("PATCH /api/tags/[id]", error);
  }
}

// DELETE /api/tags/[id]
//
// Built-ins are undeletable. For a custom tag, the slug is also stripped from
// every product that carries it — leaving it behind would show an uncoloured
// chip for a tag that no longer exists.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "tags", "delete");
    if (denied) return denied;
    await ensureTagTables();

    const { id } = await params;
    const existing = await loadTag(id);
    if (!existing) return NextResponse.json({ error: "Tag not found" }, { status: 404 });

    if (Boolean(existing.is_system)) {
      return NextResponse.json(
        { error: `"${existing.label}" is a built-in tag and can't be deleted — it's used by the storefront. Lower its priority instead if you don't want it showing.` },
        { status: 409 }
      );
    }

    const slug = String(existing.slug);

    // Find affected products by JSON containment rather than LIKE, so a tag
    // named "sale" can't match a product carrying "flash-sale".
    const affected = await query<RowDataPacket[]>(
      "SELECT id, badges, hidden_card_badges, badge_applied_at FROM products WHERE JSON_CONTAINS(badges, JSON_QUOTE(?))",
      [slug]
    );

    for (const p of affected) {
      const badges = parseJsonArray(p.badges).filter((b) => b !== slug);
      const hidden = parseJsonArray(p.hidden_card_badges).filter((b) => b !== slug);
      // badge_applied_at is an object, not an array, so it is handled directly.
      let applied: Record<string, string> = {};
      try {
        const raw = typeof p.badge_applied_at === "string" ? JSON.parse(p.badge_applied_at) : p.badge_applied_at;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) applied = raw as Record<string, string>;
      } catch { /* treat unparseable as empty */ }
      delete applied[slug];

      await execute(
        "UPDATE products SET badges = ?, hidden_card_badges = ?, badge_applied_at = ? WHERE id = ?",
        [JSON.stringify(badges), JSON.stringify(hidden), JSON.stringify(applied), p.id]
      );
    }

    await execute("DELETE FROM tags WHERE id = ?", [id]);
    await logActivity(
      "delete", "tags", id,
      `Deleted tag "${existing.label}"${affected.length ? ` and removed it from ${affected.length} product(s)` : ""}`
    ).catch(() => {});

    return NextResponse.json({ success: true, products_updated: affected.length });
  } catch (error: unknown) {
    return publicServerError("DELETE /api/tags/[id]", error);
  }
}
