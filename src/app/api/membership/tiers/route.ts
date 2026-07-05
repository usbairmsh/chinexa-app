import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM membership_tiers ORDER BY sort_order ASC"
    );
    const tiers = rows.map((r) => ({
      ...r,
      is_active: !!r.is_active,
      // DECIMAL/INT columns come back as strings from mysql2 — normalize
      min_points: Number(r.min_points) || 0,
      max_points: Number(r.max_points) || 0,
      points_multiplier: Number(r.points_multiplier) || 1,
      badge_opacity: r.badge_opacity != null ? Number(r.badge_opacity) : 1,
      sort_order: Number(r.sort_order) || 0,
      benefits: typeof r.benefits === "string" ? JSON.parse(r.benefits) : r.benefits || [],
    }));
    return NextResponse.json(tiers);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate min < max
    if (Number(body.min_points) >= Number(body.max_points)) {
      return NextResponse.json({ error: "Min points must be less than max points" }, { status: 400 });
    }

    // Check for overlapping point ranges with existing tiers
    const existing = await query<RowDataPacket[]>(
      "SELECT name, min_points, max_points FROM membership_tiers WHERE is_active = 1"
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

    const id = `tier-${Date.now()}`;
    await execute(
      "INSERT INTO membership_tiers (id, name, min_points, max_points, points_multiplier, color, badge_name, badge_color, badge_opacity, benefits, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        body.name,
        body.min_points || 0,
        body.max_points || 0,
        body.points_multiplier || 1,
        body.color || "bg-gray-100 text-gray-600",
        body.badge_name || "ChineXa General",
        body.badge_color || "#3B82F6",
        body.badge_opacity ?? 1,
        JSON.stringify(body.benefits || []),
        body.sort_order || 0,
        body.is_active !== false ? 1 : 0,
      ]
    );
    await logActivity("Created membership tier", "membership", id, body.name);
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
