import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM membership_tiers ORDER BY sort_order ASC"
    );
    const tiers = rows.map((r) => ({
      ...r,
      is_active: !!r.is_active,
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
    const id = `tier-${Date.now()}`;
    await execute(
      "INSERT INTO membership_tiers (id, name, min_points, max_points, points_multiplier, color, benefits, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        body.name,
        body.min_points || 0,
        body.max_points || 0,
        body.points_multiplier || 1,
        body.color || "bg-gray-100 text-gray-600",
        JSON.stringify(body.benefits || []),
        body.sort_order || 0,
        body.is_active !== false ? 1 : 0,
      ]
    );
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
