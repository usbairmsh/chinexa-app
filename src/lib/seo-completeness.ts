// Per-entity "SEO completeness" checks — the single source of truth for which
// fields matter for a product/brand/category/blog post to be well-optimised.
// Pure functions over the objects the admin lists already hold in memory (no
// API calls). Each returns the list of MISSING field labels; empty = complete.
//
// These are advisory only — they never block saving or change any flow. The
// admin lists render a small chip when the list is non-empty so an admin can
// see at a glance which rows need attention for SEO.

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
  // Alt text: only meaningful when there are images. Flag if ANY image lacks alt.
  else if ((p.images || []).some((img) => isBlank(img.alt))) missing.push("Image alt text");
  if (isBlank(p.short_description) && isBlank(p.description)) missing.push("Description");
  if (isBlank(p.category_name) && isBlank(p.category_id)) missing.push("Category");
  if (isBlank(p.brand_name)) missing.push("Brand");
  if (isBlank(p.seo_title)) missing.push("SEO title");
  if (isBlank(p.seo_description)) missing.push("SEO description");
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
  if (isBlank(b.seo_title)) missing.push("SEO title");
  if (isBlank(b.seo_description)) missing.push("SEO description");
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
  if (isBlank(c.seo_title)) missing.push("SEO title");
  if (isBlank(c.seo_description)) missing.push("SEO description");
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
