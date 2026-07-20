import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { requirePermission } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

// GET /api/seo — get all SEO metadata entries
export async function GET(req: NextRequest) {
  try {
    const pagePath = req.nextUrl.searchParams.get("page_path");

    if (pagePath) {
      const rows = await query<RowDataPacket[]>(
        "SELECT * FROM seo_metadata WHERE page_path = ? LIMIT 1",
        [pagePath]
      );
      return NextResponse.json(rows.length > 0 ? rows[0] : null);
    }

    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM seo_metadata ORDER BY page_path ASC"
    );
    return NextResponse.json(rows);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// POST /api/seo — create or update SEO metadata for a page
export async function POST(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "seo", "edit");
    if (denied) return denied;

    const body = await req.json();
    if (!body.page_path) {
      return NextResponse.json({ error: "page_path is required" }, { status: 400 });
    }

    // Upsert
    await execute(
      `INSERT INTO seo_metadata (page_path, title, meta_title, meta_description, keywords, canonical_url, og_title, og_description, og_image, no_index, no_follow)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       title = VALUES(title), meta_title = VALUES(meta_title), meta_description = VALUES(meta_description),
       keywords = VALUES(keywords), canonical_url = VALUES(canonical_url),
       og_title = VALUES(og_title), og_description = VALUES(og_description), og_image = VALUES(og_image),
       no_index = VALUES(no_index), no_follow = VALUES(no_follow),
       updated_at = NOW()`,
      [
        body.page_path,
        body.title || null,
        body.meta_title || null,
        body.meta_description || null,
        body.keywords ? JSON.stringify(body.keywords) : null,
        body.canonical_url || null,
        body.og_title || null,
        body.og_description || null,
        body.og_image || null,
        body.no_index ? 1 : 0,
        body.no_follow ? 1 : 0,
      ]
    );

    await logActivity("Updated SEO metadata", "settings", undefined, `Page: ${body.page_path}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// DELETE /api/seo?page_path=... — remove a page's override so it falls back
// to its built-in default metadata.
export async function DELETE(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "seo", "edit");
    if (denied) return denied;

    const pagePath = req.nextUrl.searchParams.get("page_path");
    if (!pagePath) {
      return NextResponse.json({ error: "page_path is required" }, { status: 400 });
    }
    // The _global row is the site's base title/description — it's edited from
    // the Global tab, never deleted out from under the root layout.
    if (pagePath === "_global") {
      return NextResponse.json({ error: "The global settings row cannot be deleted" }, { status: 400 });
    }

    await execute("DELETE FROM seo_metadata WHERE page_path = ?", [pagePath]);
    await logActivity("Removed SEO override", "settings", undefined, `Page: ${pagePath}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
