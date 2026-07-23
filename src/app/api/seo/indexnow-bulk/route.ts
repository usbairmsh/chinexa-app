import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { pingIndexNow } from "@/lib/indexnow";
import { requirePermission } from "@/lib/admin-permissions-server";
import { logActivity } from "@/lib/log-activity";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

// POST /api/seo/indexnow-bulk — one-shot submission of EVERY public URL to
// IndexNow (Bing/Yandex/etc). The automatic per-product pings only fire on
// create/update, so existing, untouched pages never get announced — this
// admin action covers them all at once (e.g. right after an SEO deploy).
// IndexNow accepts up to 10,000 URLs per request; we chunk defensively.
export async function POST(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "seo", "edit");
    if (denied) return denied;

    if (!process.env.INDEXNOW_KEY) {
      return NextResponse.json(
        { error: "INDEXNOW_KEY is not configured on the server — set it (and host the <key>.txt file) first." },
        { status: 400 }
      );
    }

    const urls: string[] = [
      `${siteUrl}`,
      `${siteUrl}/products`,
      `${siteUrl}/exclusive`,
      `${siteUrl}/categories/pre-orders`,
      `${siteUrl}/brands`,
      `${siteUrl}/blog`,
      `${siteUrl}/membership`,
      `${siteUrl}/about`,
      `${siteUrl}/contact`,
      `${siteUrl}/faq`,
      `${siteUrl}/track-order`,
      `${siteUrl}/collections/new-arrivals`,
      `${siteUrl}/collections/bestsellers`,
      `${siteUrl}/collections/trending`,
    ];

    const [products, categories, brands, posts] = await Promise.all([
      query<RowDataPacket[]>("SELECT slug FROM products WHERE is_active = 1 AND slug IS NOT NULL AND slug <> ''"),
      query<RowDataPacket[]>("SELECT slug FROM categories WHERE is_active = 1 AND slug IS NOT NULL AND slug <> ''"),
      query<RowDataPacket[]>("SELECT slug FROM brands WHERE is_active = 1 AND slug IS NOT NULL AND slug <> ''"),
      query<RowDataPacket[]>("SELECT slug FROM blog_posts WHERE is_published = 1 AND slug IS NOT NULL AND slug <> ''").catch(() => [] as RowDataPacket[]),
    ]);

    for (const p of products) urls.push(`${siteUrl}/products/${p.slug}`);
    for (const c of categories) urls.push(`${siteUrl}/categories/${c.slug}`);
    for (const b of brands) urls.push(`${siteUrl}/brands/${b.slug}`);
    for (const post of posts) urls.push(`${siteUrl}/blog/${post.slug}`);

    const unique = [...new Set(urls)];

    // Chunk to stay well inside the 10k/request protocol limit.
    const CHUNK = 5000;
    for (let i = 0; i < unique.length; i += CHUNK) {
      await pingIndexNow(unique.slice(i, i + CHUNK));
    }

    await logActivity(`Bulk IndexNow ping (${unique.length} URLs)`, "settings", undefined, "SEO Management");
    return NextResponse.json({
      success: true,
      submitted: unique.length,
      breakdown: { products: products.length, categories: categories.length, brands: brands.length, blog: posts.length },
    });
  } catch (error: unknown) {
    console.error("[POST /api/seo/indexnow-bulk]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to submit URLs" }, { status: 500 });
  }
}
