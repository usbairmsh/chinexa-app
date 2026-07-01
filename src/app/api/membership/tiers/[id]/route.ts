import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Validate point range if being updated
    if (body.min_points !== undefined && body.max_points !== undefined) {
      if (Number(body.min_points) >= Number(body.max_points)) {
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
        const nMin = Number(body.min_points);
        const nMax = Number(body.max_points);
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
