import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/settings?key=homepage_config (single) or ?keys=k1,k2 (multiple) or no param (all)
export async function GET(req: NextRequest) {
  try {
    const key = new URL(req.url).searchParams.get("key");
    const keys = new URL(req.url).searchParams.get("keys");

    if (key) {
      const rows = await query<RowDataPacket[]>("SELECT `key`, value FROM settings WHERE `key` = ?", [key]);
      if (rows.length === 0) return NextResponse.json(null);
      try { return NextResponse.json({ key: rows[0].key, value: JSON.parse(rows[0].value as string) }); }
      catch { return NextResponse.json({ key: rows[0].key, value: rows[0].value }); }
    }

    if (keys) {
      const keyList = keys.split(",").map((k) => k.trim()).filter(Boolean);
      if (keyList.length === 0) return NextResponse.json({});
      const placeholders = keyList.map(() => "?").join(",");
      const rows = await query<RowDataPacket[]>(`SELECT \`key\`, value FROM settings WHERE \`key\` IN (${placeholders})`, keyList);
      const result: Record<string, unknown> = {};
      for (const row of rows) {
        try { result[row.key as string] = JSON.parse(row.value as string); }
        catch { result[row.key as string] = row.value; }
      }
      return NextResponse.json(result);
    }

    // Return all
    const rows = await query<RowDataPacket[]>("SELECT `key`, value FROM settings");
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      try { result[row.key as string] = JSON.parse(row.value as string); }
      catch { result[row.key as string] = row.value; }
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// PUT /api/settings — Upsert one or more keys: { key: "x", value: {...} } or { settings: { key1: val1, key2: val2 } }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    // Single key update
    if (body.key) {
      const val = JSON.stringify(body.value);
      await execute("INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()", [body.key, val, val]);
      return NextResponse.json({ success: true });
    }

    // Bulk update
    if (body.settings && typeof body.settings === "object") {
      for (const [k, v] of Object.entries(body.settings)) {
        const val = JSON.stringify(v);
        await execute("INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()", [k, val, val]);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Provide key+value or settings object" }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
