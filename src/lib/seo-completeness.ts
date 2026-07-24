// Per-entity "SEO completeness" checks — the single source of truth for which
// fields matter for a product/brand/category/blog post to be well-optimised.
// Pure functions over the objects the admin lists already hold in memory (no
// API calls). Each returns the list of MISSING field labels; empty = complete.
//
// IMPORTANT: products, brands and categories now get AUTOMATIC intent-rich SEO
// titles + descriptions when those fields are blank (see seo-templates.ts +
// their [slug]/layout.tsx). So a blank seo_title/seo_description is NOT a real
// gap for those entities — the template covers it — and flagging it would be
// misleading. These checks therefore only flag fields with NO automatic
// fallback: images (no thumbnail otherwise), a human description, alt text,
// and category/brand assignment. Blog has no meta template, so it still checks
// its SEO title/description.
//
// Advisory only — never blocks saving or changes any flow.

const isBlank = (v: unknown): boolean =>
  v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

// ─── Products ───
export interface ProductSeoInput {
  images?: { url?: string; alt?: string }[];
  seo_title?: string;
  seo_description?: string;
  short_description?: string;
  description?: string;
  category_name?: string;
  category_id?: string;
  brand_name?: string;
}

export function productSeoMissing(p: ProductSeoInput): string[] {
  const missing: string[] = [];
  if (isBlank(p.images)) missing.push("Product image");
  // Alt text now auto-generates on save when blank, so it's no longer flagged.
  if (isBlank(p.short_description) && isBlank(p.description)) missing.push("Description");
  if (isBlank(p.category_name) && isBlank(p.category_id)) missing.push("Category");
  if (isBlank(p.brand_name)) missing.push("Brand");
  // seo_title / seo_description intentionally NOT flagged — auto-templated.
  return missing;
}

// ─── Brands ───
export interface BrandSeoInput {
  logo?: string;
  description?: string;
  seo_title?: string;
  seo_description?: string;
}

export function brandSeoMissing(b: BrandSeoInput): string[] {
  const missing: string[] = [];
  if (isBlank(b.logo)) missing.push("Logo (used as search thumbnail)");
  if (isBlank(b.description)) missing.push("Description");
  // seo_title / seo_description intentionally NOT flagged — auto-templated.
  return missing;
}

// ─── Categories ───
export interface CategorySeoInput {
  image?: string;
  description?: string;
  seo_title?: string;
  seo_description?: string;
}

export function categorySeoMissing(c: CategorySeoInput): string[] {
  const missing: string[] = [];
  if (isBlank(c.image)) missing.push("Image (used as search thumbnail)");
  if (isBlank(c.description)) missing.push("Description");
  // seo_title / seo_description intentionally NOT flagged — auto-templated.
  return missing;
}

// ─── Blog posts ───
export interface BlogSeoInput {
  featured_image?: string;
  excerpt?: string;
  content?: string;
  seo_title?: string;
  seo_description?: string;
}

export function blogSeoMissing(b: BlogSeoInput): string[] {
  const missing: string[] = [];
  if (isBlank(b.featured_image)) missing.push("Featured image");
  if (isBlank(b.excerpt)) missing.push("Excerpt");
  if (isBlank(b.content)) missing.push("Content");
  if (isBlank(b.seo_title)) missing.push("SEO title");
  if (isBlank(b.seo_description)) missing.push("SEO description");
  return missing;
}
