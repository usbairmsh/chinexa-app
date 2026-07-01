import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/products`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
  ];

  try {
    // Fetch dynamic data via internal API to avoid direct DB import issues in standalone build
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const [productsRes, categoriesRes, blogRes] = await Promise.all([
      fetch(`${baseUrl}/api/products?page_size=100&limit=500`, { cache: "no-store" }).catch(() => null),
      fetch(`${baseUrl}/api/categories`, { cache: "no-store" }).catch(() => null),
      fetch(`${baseUrl}/api/blog?all=1&limit=100`, { cache: "no-store" }).catch(() => null),
    ]);

    if (productsRes?.ok) {
      const prodData = await productsRes.json();
      const products = prodData?.data || prodData || [];
      if (Array.isArray(products)) {
        for (const p of products) {
          if (p.slug) {
            entries.push({
              url: `${siteUrl}/products/${p.slug}`,
              lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
              changeFrequency: "weekly",
              priority: 0.8,
            });
          }
        }
      }
    }

    if (categoriesRes?.ok) {
      const categories = await categoriesRes.json();
      if (Array.isArray(categories)) {
        for (const c of categories) {
          if (c.slug) {
            entries.push({
              url: `${siteUrl}/categories/${c.slug}`,
              lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
              changeFrequency: "weekly",
              priority: 0.7,
            });
          }
        }
      }
    }

    if (blogRes?.ok) {
      const posts = await blogRes.json();
      if (Array.isArray(posts)) {
        for (const post of posts) {
          if (post.slug) {
            entries.push({
              url: `${siteUrl}/blog/${post.slug}`,
              lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
              changeFrequency: "monthly",
              priority: 0.6,
            });
          }
        }
      }
    }
  } catch {
    // If APIs fail, return static pages only
  }

  return entries;
}
