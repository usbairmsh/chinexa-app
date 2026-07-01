import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
    const entityType = searchParams.get("entity_type");

    let sql = "SELECT * FROM activity_log";
    const params: string[] = [];
    if (entityType && entityType !== "all") {
      sql += " WHERE entity_type = ?";
      params.push(entityType);
    }
    sql += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const rows = await query<RowDataPacket[]>(sql, params);
    return NextResponse.json(rows);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
