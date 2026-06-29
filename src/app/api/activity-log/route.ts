import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";

interface LogRow extends RowDataPacket { [key: string]: unknown; }

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const limit = Number(new URL(req.url).searchParams.get("limit")) || 30;
    const entityType = new URL(req.url).searchParams.get("entity_type");

    let sql = "SELECT * FROM activity_log";
    const params: (string | number)[] = [];
    if (entityType) { sql += " WHERE entity_type = ?"; params.push(entityType); }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const rows = await query<LogRow[]>(sql, params);
    return NextResponse.json(rows);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await execute(
      "INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [body.user_id || "admin-1", body.user_name || "Admin", body.action, body.entity_type || null, body.entity_id || null, body.details || null, body.ip_address || null]
    );
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
