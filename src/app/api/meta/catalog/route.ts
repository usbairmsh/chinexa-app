import { NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// ─── Meta product catalog feed (RSS 2.0 / Google-Shopping spec) ───────────────
// Add this URL as a scheduled feed in Meta Commerce Manager → Catalog → Data
// sources. Meta ingests it to power dynamic product ads / Advantage+ catalog
// retargeting (showing shoppers the exact products they viewed, matched by the
// content_ids the pixel sends).
//
// Availability: in-stock products are "in stock"; a product that is out of stock
// but carries the `preorder` badge is "preorder"; everything else out of stock
// is "out of stock" (Meta prefers the item present with the right availability
// over silently dropping it, so it can resume showing it on restock).

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com").replace(/\/+$/, "");

function xmlEscape(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hasPreorderBadge(badges: unknown): boolean {
  try {
    const list = typeof badges === "string" ? JSON.parse(badges) : badges;
    return Array.isArray(list) && list.includes("preorder");
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    // Only active products. We EXCLUDE out-of-stock items that are not
    // preorderable, so ads never point at something a shopper can't buy — while
    // keeping in-stock and preorder items in the feed.
    const rows = await query<RowDataPacket[]>(
      `SELECT p.id, p.name, p.slug, p.description, p.short_description, p.price, p.compare_at_price,
              p.brand_name, p.category_name, p.stock_quantity, p.badges,
              (SELECT url FROM product_images WHERE product_id = p.id ORDER BY \`order\` LIMIT 1) AS image_url
         FROM products p
        WHERE p.is_active = 1
          AND (p.stock_quantity > 0 OR p.badges LIKE '%"preorder"%')
        ORDER BY p.created_at DESC
        LIMIT 5000`
    );

    const items = rows
      .map((p) => {
        const inStock = Number(p.stock_quantity) > 0;
        const availability = inStock ? "in stock" : hasPreorderBadge(p.badges) ? "preorder" : "out of stock";
        const price = Number(p.price) || 0;
        const compareAt = p.compare_at_price != null ? Number(p.compare_at_price) : null;

        const link = `${SITE_URL}/products/${p.slug}`;
        const imageRaw = (p.image_url as string) || "";
        const image = imageRaw ? (imageRaw.startsWith("http") ? imageRaw : `${SITE_URL}${imageRaw}`) : `${SITE_URL}/logo.png`;
        const desc = (p.short_description || p.description || p.name || "").toString().replace(/<[^>]+>/g, "").slice(0, 5000);

        // Meta requires g:price as "<amount> <currency>". When there's a compare-
        // at (was) price higher than the selling price, price = the higher (was)
        // and sale_price = the current, so Meta shows a strikethrough correctly.
        const onSale = compareAt != null && compareAt > price;
        const listPrice = onSale ? compareAt! : price;

        return [
          "    <item>",
          `      <g:id>${xmlEscape(String(p.id))}</g:id>`,
          `      <g:title>${xmlEscape(String(p.name))}</g:title>`,
          `      <g:description>${xmlEscape(desc)}</g:description>`,
          `      <g:link>${xmlEscape(link)}</g:link>`,
          `      <g:image_link>${xmlEscape(image)}</g:image_link>`,
          `      <g:availability>${availability}</g:availability>`,
          `      <g:condition>new</g:condition>`,
          `      <g:price>${listPrice.toFixed(2)} BDT</g:price>`,
          onSale ? `      <g:sale_price>${price.toFixed(2)} BDT</g:sale_price>` : "",
          p.brand_name ? `      <g:brand>${xmlEscape(String(p.brand_name))}</g:brand>` : `      <g:brand>ChineXa</g:brand>`,
          p.category_name ? `      <g:product_type>${xmlEscape(String(p.category_name))}</g:product_type>` : "",
          "    </item>",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>ChineXa Product Catalog</title>
    <link>${SITE_URL}</link>
    <description>ChineXa product feed for Meta Commerce</description>
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        // Cache at the edge for an hour — Meta polls on a schedule, not per view.
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[meta/catalog] feed failed:", error);
    return new NextResponse("<?xml version=\"1.0\"?><rss version=\"2.0\"><channel></channel></rss>", {
      status: 500,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }
}
