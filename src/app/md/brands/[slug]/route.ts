import { type RowDataPacket } from "mysql2/promise";
import pool from "@/lib/db";
import { markdownResponse, mdEscape, withMarkdownErrorHandling } from "@/lib/markdown-response";
import { formatCurrency } from "@/lib/utils";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
const PRODUCT_LIMIT = 30;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return withMarkdownErrorHandling(async () => {
  const { slug } = await params;

  const [brandRows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, name, description, country FROM brands WHERE (slug = ? OR id = ?) AND is_active = 1 LIMIT 1",
    [slug, slug]
  );

  if (brandRows.length === 0) {
    return markdownResponse(`# Not Found\n\nNo brand found at this URL.\n`, { status: 404 });
  }

  const brand = brandRows[0];
  const [products] = await pool.execute<RowDataPacket[]>(
    `SELECT name, slug, price, compare_at_price FROM products
     WHERE is_active = 1 AND brand_id = ?
     ORDER BY is_featured DESC, created_at DESC LIMIT ${PRODUCT_LIMIT}`,
    [brand.id]
  );

  const lines: string[] = [];
  lines.push(`# ${brand.name}`);
  lines.push("");
  if (brand.country) lines.push(`**Country:** ${brand.country}`);
  if (brand.description) { lines.push(""); lines.push(brand.description as string); }
  lines.push("");
  lines.push(`${products.length} product${products.length === 1 ? "" : "s"} shown${products.length === PRODUCT_LIMIT ? " (more available on site)" : ""}.`);
  lines.push("");

  if (products.length > 0) {
    lines.push("| Product | Price |");
    lines.push("|---|---|");
    for (const p of products) {
      const price = p.compare_at_price
        ? `${formatCurrency(Number(p.price))} ~~${formatCurrency(Number(p.compare_at_price))}~~`
        : formatCurrency(Number(p.price));
      lines.push(`| [${mdEscape(p.name as string)}](${siteUrl}/products/${p.slug}) | ${price} |`);
    }
    lines.push("");
  }

  lines.push(`[View on site](${siteUrl}/brands/${slug})`);

  return markdownResponse(lines.join("\n"));
  });
}
