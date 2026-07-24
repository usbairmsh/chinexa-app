import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { requirePermission } from "@/lib/admin-permissions-server";
import { logActivity } from "@/lib/log-activity";

export const dynamic = "force-dynamic";

// POST /api/seo/reset-category-meta — clears stored seo_title/seo_description on
// categories so the automatic, intent-rich templates (getProductsList /
// categories/[slug]/layout.tsx) take over. A category's own seo_* value wins
// over the template, so these stale stored titles (e.g. the old
// "X — Shop Online in Bangladesh" pattern) currently suppress the new
// "X Price in Bangladesh — Buy 100% Original X Online" titles.
//
// Body: { mode: "stale" | "all" }
//   "stale" (default) — only clears categories whose seo_title matches the
//     known legacy pattern ("… Shop Online in Bangladesh"), so genuinely
//     custom, deliberate titles are left untouched.
//   "all" — clears every category's seo_title/seo_description.
export async function POST(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "seo", "edit");
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "all" ? "all" : "stale";

    // Preview which rows will be affected (name kept for the response/log).
    let affected: RowDataPacket[];
    if (mode === "all") {
      affected = await query<RowDataPacket[]>(
        "SELECT id, name, seo_title FROM categories WHERE (seo_title IS NOT NULL AND seo_title <> '') OR (seo_description IS NOT NULL AND seo_description <> '')"
      );
      await execute("UPDATE categories SET seo_title = NULL, seo_description = NULL WHERE (seo_title IS NOT NULL AND seo_title <> '') OR (seo_description IS NOT NULL AND seo_description <> '')");
    } else {
      // Legacy auto-generated pattern from before the intent-rich templates.
      const like = "%Shop Online in Bangladesh%";
      affected = await query<RowDataPacket[]>(
        "SELECT id, name, seo_title FROM categories WHERE seo_title LIKE ?",
        [like]
      );
      await execute("UPDATE categories SET seo_title = NULL, seo_description = NULL WHERE seo_title LIKE ?", [like]);
    }

    const names = affected.map((r) => String(r.name));
    await logActivity(
      `Reset category SEO meta to auto (${mode}, ${names.length} categories)`,
      "seo",
      undefined,
      names.join(", ").slice(0, 250) || "none"
    );

    return NextResponse.json({ success: true, mode, cleared: names.length, categories: names });
  } catch (error: unknown) {
    console.error("[POST /api/seo/reset-category-meta]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to reset category SEO" }, { status: 500 });
  }
}
