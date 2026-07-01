import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";

export const dynamic = "force-dynamic";

interface TierData {
  id: string; name: string; min_points: number; max_points: number;
  points_multiplier: number; color: string;
  badge_name: string; badge_color: string; badge_opacity: number;
  benefits: string[]; sort_order: number; is_active: boolean;
}

// GET /api/customers/[id]/points — get points balance, history, and tier
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get total points balance
    const balanceRows = await query<RowDataPacket[]>(
      "SELECT COALESCE(SUM(points), 0) as total_points FROM customer_points WHERE customer_id = ?",
      [id]
    );
    const totalPoints = Number(balanceRows[0]?.total_points) || 0;

    // Get points history (latest 50)
    const history = await query<RowDataPacket[]>(
      "SELECT * FROM customer_points WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50",
      [id]
    );

    // Get all tiers to determine current tier and next tier
    const tiers = await query<RowDataPacket[]>(
      "SELECT * FROM membership_tiers WHERE is_active = 1 ORDER BY sort_order ASC"
    );
    const parsedTiers: TierData[] = tiers.map((t) => ({
      id: t.id as string,
      name: t.name as string,
      min_points: Number(t.min_points),
      max_points: Number(t.max_points),
      points_multiplier: Number(t.points_multiplier),
      color: t.color as string,
      badge_name: (t.badge_name as string) || "ChineXa General",
      badge_color: (t.badge_color as string) || "#3B82F6",
      badge_opacity: Number(t.badge_opacity ?? 1),
      benefits: typeof t.benefits === "string" ? JSON.parse(t.benefits) : t.benefits || [],
      sort_order: Number(t.sort_order),
      is_active: !!t.is_active,
    }));

    let currentTier: TierData | null = null;
    let nextTier: TierData | null = null;
    for (let i = 0; i < parsedTiers.length; i++) {
      const tier = parsedTiers[i];
      if (totalPoints >= tier.min_points && totalPoints <= tier.max_points) {
        currentTier = tier;
        nextTier = parsedTiers[i + 1] || null;
        break;
      }
    }
    // If points exceed all tiers, assign highest
    if (!currentTier && parsedTiers.length > 0) {
      if (totalPoints > parsedTiers[parsedTiers.length - 1].max_points) {
        currentTier = parsedTiers[parsedTiers.length - 1];
        nextTier = null;
      } else if (totalPoints < parsedTiers[0].min_points) {
        currentTier = null;
        nextTier = parsedTiers[0];
      }
    }

    const pointsToNextTier = nextTier ? nextTier.min_points - totalPoints : 0;

    return NextResponse.json({
      total_points: totalPoints,
      tier: currentTier,
      next_tier: nextTier,
      points_to_next_tier: pointsToNextTier,
      history,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// POST /api/customers/[id]/points — admin: add/deduct points
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { points, type, description, reference_id } = body;

    if (!points || !type) {
      return NextResponse.json({ error: "points and type are required" }, { status: 400 });
    }

    const entryId = `pts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await execute(
      "INSERT INTO customer_points (id, customer_id, points, type, reference_id, description) VALUES (?, ?, ?, ?, ?, ?)",
      [entryId, id, points, type, reference_id || null, description || null]
    );

    return NextResponse.json({ success: true, id: entryId }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
