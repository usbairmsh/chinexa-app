import { type RowDataPacket } from "mysql2/promise";
import pool from "@/lib/db";
import { markdownResponse, mdEscape, withMarkdownErrorHandling } from "@/lib/markdown-response";
import { formatCurrency } from "@/lib/utils";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
const PRODUCT_LIMIT = 30;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return withMarkdownErrorHandling(async () => {
  const { slug } = await params;

  const [catRows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, name, description FROM categories WHERE (slug = ? OR id = ?) AND is_active = 1 LIMIT 1",
    [slug, slug]
  );

  if (catRows.length === 0) {
    return markdownResponse(`# Not Found\n\nNo category found at this URL.\n`, { status: 404 });
  }

  const category = catRows[0];
  const [products] = await pool.execute<RowDataPacket[]>(
    `SELECT name, slug, price, compare_at_price FROM products
     WHERE is_active = 1 AND (category_id = ? OR category_id IN (SELECT id FROM categories WHERE parent_id = ?))
     ORDER BY is_featured DESC, created_at DESC LIMIT ${PRODUCT_LIMIT}`,
    [category.id, category.id]
  );

  const lines: string[] = [];
  lines.push(`# ${category.name}`);
  lines.push("");
  if (category.description) { lines.push(category.description as string); lines.push(""); }
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

  lines.push(`[View on site](${siteUrl}/categories/${slug})`);

  return markdownResponse(lines.join("\n"));
  });
}
