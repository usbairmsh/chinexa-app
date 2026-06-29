import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";

interface BannerRow extends RowDataPacket { [key: string]: unknown; }

export async function GET(req: NextRequest) {
  try {
    const position = new URL(req.url).searchParams.get("position");
    const all = new URL(req.url).searchParams.get("all");
    let sql = all ? "SELECT * FROM banners WHERE 1=1" : "SELECT * FROM banners WHERE is_active = 1";
    const params: string[] = [];
    if (position) { sql += " AND position = ?"; params.push(position); }
    sql += " ORDER BY `order`";
    const rows = await query<BannerRow[]>(sql, params);
    return NextResponse.json(rows.map((r) => ({ ...r, is_active: !!r.is_active })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = `banner-${Date.now()}`;
    await execute(
      "INSERT INTO banners (id, title, subtitle, image, mobile_image, link, cta_text, position, focal_point, `order`, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, body.title, body.subtitle || null, body.image, body.mobile_image || null, body.link || null, body.cta_text || null, body.position || "hero", body.focal_point || "50% 50%", body.order || 0, body.is_active !== false ? 1 : 0]
    );
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
