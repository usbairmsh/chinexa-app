import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query<RowDataPacket[]>(
      "SELECT `key`, value FROM settings WHERE `key` IN ('points_per_taka', 'points_enabled')"
    );
    const settings: Record<string, unknown> = {
      points_per_taka: 10,
      points_enabled: true,
    };
    for (const r of rows) {
      const val = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
      settings[r.key as string] = val;
    }
    return NextResponse.json(settings);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.points_per_taka !== undefined) {
      await execute(
        "INSERT INTO settings (`key`, value) VALUES ('points_per_taka', ?) ON DUPLICATE KEY UPDATE value = ?",
        [JSON.stringify(body.points_per_taka), JSON.stringify(body.points_per_taka)]
      );
    }
    if (body.points_enabled !== undefined) {
      await execute(
        "INSERT INTO settings (`key`, value) VALUES ('points_enabled', ?) ON DUPLICATE KEY UPDATE value = ?",
        [JSON.stringify(body.points_enabled), JSON.stringify(body.points_enabled)]
      );
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
