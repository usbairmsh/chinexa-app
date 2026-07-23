import { cache } from "react";
import { query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// ─────────────────────────────────────────────────────────────────────────────
// Automated, durable SEO templates for categories and products.
//
// Everything here is COMPUTED at render time from live database data (names,
// prices, product counts, brands), so any category or product added later is
// fully SEO'd with zero manual work, and the copy self-updates as the catalog
// changes. Deliberately evergreen: no years, no seasonal wording — built on the
// stable search patterns Bangladeshi shoppers use ("price in Bangladesh",
// "original/authentic", "cash on delivery", "online shopping", "best price",
// Dhaka delivery), which don't churn over time.
//
// Precedence is never changed by this module — callers only use these as the
// FALLBACK when no explicit seo_title/seo_description is set, and admin
// Page-Meta overrides still win on top of everything.
// ─────────────────────────────────────────────────────────────────────────────

// Category-name → extra keyword variants Bangladeshis actually type. Matched by
// substring against the category/subcategory name, so new categories that fit a
// rule inherit it automatically and unknown ones simply use the base template.
// NOTE: BD searchers strongly favour the British "jewellery" spelling.
const SYNONYM_RULES: { match: RegExp; synonyms: string[] }[] = [
  { match: /jewel/i, synonyms: ["jewellery", "jewelry"] },
  { match: /perfume|fragrance/i, synonyms: ["fragrance", "body spray"] },
  { match: /bag/i, synonyms: ["handbag", "ladies bag", "purse"] },
  { match: /shoe|footwear|heel|sandal/i, synonyms: ["footwear", "ladies shoes"] },
  { match: /skin|beauty|cosmetic/i, synonyms: ["beauty products", "cosmetics"] },
  { match: /watch/i, synonyms: ["watches", "wrist watch"] },
  { match: /makeup|make-up/i, synonyms: ["makeup", "cosmetics"] },
  { match: /import/i, synonyms: ["imported products", "foreign products"] },
];

export function getCategorySynonyms(name: string): string[] {
  const out: string[] = [];
  for (const rule of SYNONYM_RULES) {
    if (rule.match.test(name)) out.push(...rule.synonyms);
  }
  // Dedupe + drop any synonym identical to the name itself
  return [...new Set(out)].filter((s) => s.toLowerCase() !== name.toLowerCase());
}

export interface CategorySeoStats {
  count: number;
  minPrice: number | null;
  brands: string[];
}

/**
 * Live stats for a category (or subcategory) used to make its meta description
 * unique, price-rich and self-updating. One cheap aggregate query + one small
 * brands query; React cache() dedupes across generateMetadata + the layout
 * body within a request. Best-effort: failures return empty stats and the
 * caller falls back to the stat-less template.
 */
export const getCategorySeoStats = cache(async (
  categoryId: string,
  categoryName: string,
  isSubcategory: boolean
): Promise<CategorySeoStats> => {
  try {
    // Subcategory rows match products via products.subcategory (by name);
    // parent categories via products.category_id.
    const where = isSubcategory ? "subcategory = ? AND is_active = 1" : "category_id = ? AND is_active = 1";
    const param = isSubcategory ? categoryName : categoryId;
    const [agg, brandRows] = await Promise.all([
      query<RowDataPacket[]>(`SELECT COUNT(*) AS c, MIN(price) AS p FROM products WHERE ${where}`, [param]),
      query<RowDataPacket[]>(
        `SELECT DISTINCT brand_name FROM products WHERE ${where} AND brand_name IS NOT NULL AND brand_name <> '' LIMIT 3`,
        [param]
      ),
    ]);
    return {
      count: Number(agg[0]?.c) || 0,
      minPrice: agg[0]?.p != null ? Number(agg[0].p) : null,
      brands: brandRows.map((r) => String(r.brand_name)).filter(Boolean),
    };
  } catch {
    return { count: 0, minPrice: null, brands: [] };
  }
});

const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-BD")}`;

/** `Skincare Price in Bangladesh — Buy 100% Original Skincare Online` (root template appends "| ChineXa") */
export function categorySeoTitle(name: string): string {
  return `${name} Price in Bangladesh — Buy 100% Original ${name} Online`;
}

/** Intent-rich, evergreen description with live price/count when available. */
export function categorySeoDescription(name: string, stats: CategorySeoStats): string {
  const synonyms = getCategorySynonyms(name);
  const synonymPart = synonyms.length > 0 ? ` (${synonyms[0]})` : "";
  const pricePart = stats.minPrice != null && stats.minPrice > 0 ? ` starting from ${taka(stats.minPrice)}` : " at the best price";
  const countPart = stats.count > 0 ? `${stats.count}+ authentic products, ` : "";
  return (
    `Buy 100% original ${name.toLowerCase()}${synonymPart} online in Bangladesh${pricePart}. ` +
    `${countPart}cash on delivery all over BD, fast Dhaka delivery & 7-day easy returns.`
  ).slice(0, 160);
}

/** Keywords meta — evergreen BD intent variants for the category. */
export function categorySeoKeywords(name: string): string[] {
  const n = name.toLowerCase();
  return [
    `${n} price in bangladesh`,
    `${n} price in bd`,
    `original ${n} bd`,
    `buy ${n} online bangladesh`,
    `${n} online shopping bd`,
    ...getCategorySynonyms(name).map((s) => `${s.toLowerCase()} price in bangladesh`),
  ];
}

/** `{Product} Price in Bangladesh | Original {Brand}` — brand dropped when absent or the title would run long. */
export function productSeoTitle(name: string, brandName?: string | null): string {
  const base = `${name} Price in Bangladesh`;
  if (brandName && (base.length + brandName.length + 12) <= 70) {
    return `${base} | Original ${brandName}`;
  }
  return `${base} — Buy Original Online`;
}

/** Price-led, authenticity-led product description; folds in the product's own
 *  short description when there's room so it stays specific. */
export function productSeoDescription(
  name: string,
  price: number,
  opts?: { brandName?: string | null; categoryName?: string | null; shortDescription?: string | null }
): string {
  const source = opts?.brandName || opts?.categoryName;
  const authentic = source ? `100% authentic ${source}` : "100% authentic";
  const lead = `Buy original ${name} at ${taka(price)} in Bangladesh — ${authentic}, cash on delivery across BD & fast Dhaka delivery.`;
  const extra = (opts?.shortDescription || "").trim().replace(/\s+/g, " ");
  const combined = extra ? `${lead} ${extra}` : lead;
  return combined.slice(0, 160);
}

/**
 * Live stats for a brand page — same idea as getCategorySeoStats. Matches by
 * brand_id with a brand_name fallback (older rows sometimes carry only the
 * name). Cached per request; best-effort.
 */
export const getBrandSeoStats = cache(async (brandId: string, brandName: string): Promise<CategorySeoStats> => {
  try {
    const agg = await query<RowDataPacket[]>(
      "SELECT COUNT(*) AS c, MIN(price) AS p FROM products WHERE (brand_id = ? OR brand_name = ?) AND is_active = 1",
      [brandId, brandName]
    );
    return {
      count: Number(agg[0]?.c) || 0,
      minPrice: agg[0]?.p != null ? Number(agg[0].p) : null,
      brands: [],
    };
  } catch {
    return { count: 0, minPrice: null, brands: [] };
  }
});

/** `{Brand} Price in Bangladesh — Buy 100% Original {Brand} Products` */
export function brandSeoTitle(name: string): string {
  return `${name} Price in Bangladesh — Buy 100% Original ${name} Products`;
}

/** Intent-rich, evergreen brand description with live price/count + origin country. */
export function brandSeoDescription(name: string, stats: CategorySeoStats, country?: string | null): string {
  const originPart = country ? ` direct from ${country}` : "";
  const pricePart = stats.minPrice != null && stats.minPrice > 0 ? ` starting from ${taka(stats.minPrice)}` : " at the best price";
  const countPart = stats.count > 0 ? `${stats.count}+ authentic products, ` : "";
  return (
    `Buy 100% original ${name} products online in Bangladesh${pricePart} — sourced${originPart || " from authorised suppliers"}. ` +
    `${countPart}cash on delivery all over BD, fast Dhaka delivery & 7-day easy returns.`
  ).slice(0, 160);
}

/** Keywords meta for a brand page. */
export function brandSeoKeywords(name: string): string[] {
  const n = name.toLowerCase();
  return [
    `${n} price in bangladesh`,
    `${n} bd`,
    `original ${n} bangladesh`,
    `${n} products price in bd`,
    `buy ${n} online bangladesh`,
    `${n} bangladesh official`,
  ];
}

/** Keywords meta for a product page. */
export function productSeoKeywords(name: string, brandName?: string | null, categoryName?: string | null): string[] {
  const n = name.toLowerCase();
  const out = [
    `${n} price in bangladesh`,
    `${n} price in bd`,
    `original ${n}`,
    `buy ${n} online bd`,
  ];
  if (brandName) out.push(`${brandName.toLowerCase()} bangladesh`, `original ${brandName.toLowerCase()} bd`);
  if (categoryName) out.push(`${categoryName.toLowerCase()} price in bangladesh`);
  return out;
}
