import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError, publicServerError } from "@/lib/validate";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { requirePermission } from "@/lib/admin-permissions-server";

interface BannerRow extends RowDataPacket { [key: string]: unknown; }

export async function GET(req: NextRequest) {
  try {
    await ensurePromotionColumns();
    const position = new URL(req.url).searchParams.get("position");
    const all = new URL(req.url).searchParams.get("all");
    let sql = all ? "SELECT * FROM banners WHERE 1=1" : "SELECT * FROM banners WHERE is_active = 1";
    const params: string[] = [];
    if (position) { sql += " AND position = ?"; params.push(position); }
    sql += " ORDER BY `order`";
    const rows = await query<BannerRow[]>(sql, params);
    return NextResponse.json(rows.map((r) => ({
      ...r,
      is_active: !!r.is_active,
      settings: typeof r.settings === "string" ? JSON.parse(r.settings) : r.settings || null,
    })));
  } catch (error: unknown) {
    return publicServerError("GET /api/banners", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "banners", "add");
    if (denied) return denied;
    await ensurePromotionColumns();
    const body = await req.json();
    const err = validate([
      { field: "title", value: body.title, rules: ["required", "string"], label: "Banner title" },
      { field: "image", value: body.image, rules: ["required", "string"], label: "Banner image" },
      { field: "position", value: body.position || "hero", rules: [{ oneOf: ["hero", "promo", "category", "popup"] }], label: "Position" },
    ]);
    if (err) return validationError(err);
    const id = `banner-${Date.now()}`;
    await execute(
      "INSERT INTO banners (id, title, subtitle, image, mobile_image, link, cta_text, position, focal_point, settings, `order`, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id, body.title, body.subtitle || null, body.image, body.mobile_image || null, body.link || null, body.cta_text || null,
        body.position || "hero", body.focal_point || "50% 50%",
        body.settings ? JSON.stringify(body.settings) : null,
        body.order || 0, body.is_active !== false ? 1 : 0,
      ]
    );
    await logActivity("Created banner", "banner", id, body.title);
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    // Admin-only route — surface the real error instead of a generic message
    // that hides which field/constraint actually failed.
    console.error("[POST /api/banners]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create banner" }, { status: 500 });
  }
}
