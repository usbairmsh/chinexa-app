import { type RowDataPacket } from "mysql2/promise";
import pool from "@/lib/db";
import { markdownResponse, mdEscape, withMarkdownErrorHandling } from "@/lib/markdown-response";
import { formatCurrency } from "@/lib/utils";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return withMarkdownErrorHandling(async () => {
  const { slug } = await params;

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, name, sku, price, compare_at_price, short_description, description, category_name,
            brand_name, average_rating, review_count, stock_quantity, country_of_origin, ingredients,
            how_to_use, tags
     FROM products WHERE slug = ? AND is_active = 1 LIMIT 1`,
    [slug]
  );

  if (rows.length === 0) {
    return markdownResponse(`# Not Found\n\nNo product found at this URL.\n`, { status: 404 });
  }

  const p = rows[0];
  const variants = (await pool.execute<RowDataPacket[]>(
    "SELECT name, value, price_adjustment, stock FROM product_variants WHERE product_id = ?",
    [p.id]
  ))[0];

  const basePrice = Number(p.price);
  const tags: string[] = typeof p.tags === "string" ? JSON.parse(p.tags || "[]") : p.tags || [];

  const lines: string[] = [];
  lines.push(`# ${mdEscape(p.name as string)}`);
  lines.push("");
  lines.push(`**Price:** ${formatCurrency(basePrice)}${p.compare_at_price ? ` ~~${formatCurrency(Number(p.compare_at_price))}~~` : ""}`);
  if (p.category_name) lines.push(`**Category:** ${p.category_name}`);
  if (p.brand_name) lines.push(`**Brand:** ${p.brand_name}`);
  if (p.country_of_origin) lines.push(`**Country of Origin:** ${p.country_of_origin}`);
  lines.push(`**In Stock:** ${Number(p.stock_quantity) > 0 ? "Yes" : "No"}`);
  if (Number(p.review_count) > 0) lines.push(`**Rating:** ${Number(p.average_rating).toFixed(1)}/5 (${p.review_count} reviews)`);
  lines.push(`**SKU:** ${p.sku}`);
  lines.push("");

  if (p.short_description || p.description) {
    lines.push("## Description");
    lines.push("");
    lines.push((p.short_description as string) || "");
    if (p.description && p.description !== p.short_description) {
      lines.push("");
      lines.push(p.description as string);
    }
    lines.push("");
  }

  if (variants.length > 0) {
    lines.push("## Variants");
    lines.push("");
    lines.push("| Option | Value | Price | Stock |");
    lines.push("|---|---|---|---|");
    for (const v of variants) {
      const price = basePrice + Number(v.price_adjustment);
      lines.push(`| ${mdEscape(v.name as string)} | ${mdEscape(v.value as string)} | ${formatCurrency(price)} | ${Number(v.stock) > 0 ? "In stock" : "Out of stock"} |`);
    }
    lines.push("");
  }

  if (p.ingredients) {
    lines.push("## Ingredients");
    lines.push("");
    lines.push(p.ingredients as string);
    lines.push("");
  }

  if (p.how_to_use) {
    lines.push("## How to Use");
    lines.push("");
    lines.push(p.how_to_use as string);
    lines.push("");
  }

  if (tags.length > 0) {
    lines.push(`**Tags:** ${tags.join(", ")}`);
    lines.push("");
  }

  lines.push(`[View on site](${siteUrl}/products/${slug})`);

  return markdownResponse(lines.join("\n"));
  });
}
