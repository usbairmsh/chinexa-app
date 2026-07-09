import { query } from "@/lib/db";
import { markdownResponse, withMarkdownErrorHandling } from "@/lib/markdown-response";
import { MAIN_NAV } from "@/data/constants/navigation";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

const DEFAULT_TITLE = "ChineXa — Premium Beauty, Skincare & Lifestyle Store in Bangladesh";
const DEFAULT_DESCRIPTION =
  "Shop authentic Korean skincare, luxury bags, exquisite jewelry, fine perfumes & imported beauty products in Bangladesh. Free delivery on orders over ৳3,000. Genuine products with cash on delivery.";

// The homepage is assembled from many independent client-side data fetches
// (banners, featured/trending products, testimonials) with no single stable
// document to convert faithfully — so this is a lightweight, honest summary
// + links to the real content, not an attempt to reproduce every section.
// Title/description are read from the same seo_metadata row the real
// homepage <title>/meta description use, so this never drifts out of sync.
export async function GET() {
  return withMarkdownErrorHandling(async () => {
    let title = DEFAULT_TITLE;
    let description = DEFAULT_DESCRIPTION;
    try {
      const rows = await query("SELECT title, meta_description FROM seo_metadata WHERE page_path = '_global' LIMIT 1");
      if (rows.length > 0) {
        if (rows[0].title) title = rows[0].title as string;
        if (rows[0].meta_description) description = rows[0].meta_description as string;
      }
    } catch {}

    const lines: string[] = [];
    lines.push(`# ${title}`);
    lines.push("");
    lines.push(description);
    lines.push("");
    lines.push("This is a summary of the ChineXa homepage — not a full render of its interactive sections (banners, featured/trending product carousels, testimonials). For those, use the links below or the public API.");
    lines.push("");

    lines.push("## Shop by Category");
    lines.push("");
    for (const item of MAIN_NAV) {
      lines.push(`- [${item.label}](${siteUrl}${item.href})`);
    }
    lines.push("");

    lines.push("## More");
    lines.push("");
    lines.push(`- [All products](${siteUrl}/products)`);
    lines.push(`- [Membership benefits](${siteUrl}/membership)`);
    lines.push(`- [Blog](${siteUrl}/blog)`);
    lines.push(`- [Track an order](${siteUrl}/track-order)`);
    lines.push(`- [Contact](${siteUrl}/contact)`);
    lines.push("");

    lines.push("## For Agents");
    lines.push("");
    lines.push(`- [Public API catalog](${siteUrl}/.well-known/api-catalog)`);
    lines.push(`- [Auth requirements](${siteUrl}/auth.md) — none; the public API is open`);
    lines.push(`- [Agent skills index](${siteUrl}/.well-known/agent-skills/index.json)`);
    lines.push("");
    lines.push(`[View the full interactive homepage](${siteUrl}/)`);

    return markdownResponse(lines.join("\n"));
  });
}
