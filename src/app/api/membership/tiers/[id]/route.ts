import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensurePromotionColumns();
    const { id } = await params;
    const body = await req.json();

    // Validate point range whenever EITHER bound is being updated — not just
    // when both arrive together. A PUT sending only min_points (or only
    // max_points) previously skipped this check entirely, since the old
    // condition required both fields present in the same request; that let a
    // single-field update invert or overlap the tier's range unchecked.
    if (body.min_points !== undefined || body.max_points !== undefined) {
      const currentRows = await query<RowDataPacket[]>(
        "SELECT min_points, max_points FROM membership_tiers WHERE id = ? LIMIT 1",
        [id]
      );
      if (currentRows.length === 0) return NextResponse.json({ error: "Tier not found" }, { status: 404 });
      const nMin = body.min_points !== undefined ? Number(body.min_points) : Number(currentRows[0].min_points);
      const nMax = body.max_points !== undefined ? Number(body.max_points) : Number(currentRows[0].max_points);

      if (nMin >= nMax) {
        return NextResponse.json({ error: "Min points must be less than max points" }, { status: 400 });
      }
      // Check overlap with other tiers (exclude self)
      const existing = await query<RowDataPacket[]>(
        "SELECT name, min_points, max_points FROM membership_tiers WHERE id != ? AND is_active = 1",
        [id]
      );
      for (const tier of existing) {
        const eMin = Number(tier.min_points);
        const eMax = Number(tier.max_points);
        if (nMin <= eMax && nMax >= eMin) {
          return NextResponse.json({ error: `Point range overlaps with "${tier.name}" (${eMin}–${eMax} points)` }, { status: 400 });
        }
      }
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    for (const [k, col] of Object.entries({
      name: "name",
      min_points: "min_points",
      max_points: "max_points",
      points_multiplier: "points_multiplier",
      color: "color",
      badge_name: "badge_name",
      badge_color: "badge_color",
      badge_opacity: "badge_opacity",
      sort_order: "sort_order",
    })) {
      if (body[k] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(body[k]);
      }
    }
    if (body.benefits !== undefined) {
      fields.push("benefits = ?");
      values.push(JSON.stringify(body.benefits));
    }
    if (body.is_active !== undefined) {
      fields.push("is_active = ?");
      values.push(body.is_active ? 1 : 0);
    }
    if (body.badge_enabled !== undefined) {
      fields.push("badge_enabled = ?");
      values.push(body.badge_enabled ? 1 : 0);
    }
    if (fields.length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });
    values.push(id);
    await execute(`UPDATE membership_tiers SET ${fields.join(", ")} WHERE id = ?`, values);
    await logActivity("Updated membership tier", "membership", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await execute("DELETE FROM membership_tiers WHERE id = ?", [id]);
    await logActivity("Deleted membership tier", "membership", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
