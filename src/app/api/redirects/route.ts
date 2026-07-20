import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { requirePermission } from "@/lib/admin-permissions-server";
import { ensureRedirectsTable, normalizePath } from "@/lib/redirects";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureRedirectsTable();
    const rows = await query<RowDataPacket[]>("SELECT * FROM redirects ORDER BY created_at DESC");
    return NextResponse.json(rows.map((r) => ({ ...r, is_active: !!r.is_active })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // The seo permission section only declares view/edit actions, so all
    // redirect mutations sit under "edit" — same gate as page-meta upserts.
    const denied = await requirePermission(req, "seo", "edit");
    if (denied) return denied;
    await ensureRedirectsTable();

    const body = await req.json();
    const fromPath = normalizePath(String(body.from_path || ""));
    const toRaw = String(body.to_path || "").trim();
    // Destination may be an internal path or a full external URL.
    const toPath = /^https?:\/\//i.test(toRaw) ? toRaw : normalizePath(toRaw);
    const type = Number(body.redirect_type) === 302 ? 302 : 301;

    if (fromPath === "/" || fromPath.length < 2) {
      return NextResponse.json({ error: "From path must be a specific path like /old-page" }, { status: 400 });
    }
    if (!toRaw) {
      return NextResponse.json({ error: "Destination path is required" }, { status: 400 });
    }
    if (fromPath === toPath) {
      return NextResponse.json({ error: "A redirect cannot point to itself" }, { status: 400 });
    }
    // Reject a two-hop loop at save time (A→B while B→A already exists).
    const loop = await query<RowDataPacket[]>(
      "SELECT id FROM redirects WHERE from_path = ? AND to_path = ? LIMIT 1",
      [toPath, fromPath]
    );
    if (loop.length > 0) {
      return NextResponse.json({ error: `This would create a redirect loop with ${toPath} → ${fromPath}` }, { status: 400 });
    }

    await execute(
      `INSERT INTO redirects (from_path, to_path, redirect_type, is_active) VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE to_path = VALUES(to_path), redirect_type = VALUES(redirect_type), is_active = 1`,
      [fromPath, toPath, type]
    );
    await logActivity("Added URL redirect", "settings", undefined, `${fromPath} → ${toPath} (${type})`);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
