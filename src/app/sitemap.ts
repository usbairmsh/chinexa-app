import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
// Fetch our own APIs over loopback — fetching the public domain from inside the
// container can fail (hairpin NAT), which would silently drop all dynamic URLs.
const internalUrl = `http://127.0.0.1:${process.env.PORT || 3000}`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/products`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/brands`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/collections/new-arrivals`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/collections/bestsellers`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/collections/trending`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/track-order`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/policies/shipping`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/policies/returns`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/policies/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/policies/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    // Products — paginate so catalogs beyond 100 items are fully covered
    for (let page = 1; page <= 5; page++) {
      const res = await fetch(`${internalUrl}/api/products?page=${page}&page_size=100`, { cache: "no-store" }).catch(() => null);
      if (!res?.ok) break;
      const prodData = await res.json();
      const products = Array.isArray(prodData?.data) ? prodData.data : [];
      for (const p of products) {
        if (p.slug && p.is_active !== false) {
          entries.push({
            url: `${siteUrl}/products/${p.slug}`,
            lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
          });
        }
      }
      if (products.length < 100 || page >= Number(prodData?.total_pages || 1)) break;
    }

    const [categoriesRes, blogRes, brandsRes] = await Promise.all([
      fetch(`${internalUrl}/api/categories`, { cache: "no-store" }).catch(() => null),
      fetch(`${internalUrl}/api/blog?all=1&limit=100`, { cache: "no-store" }).catch(() => null),
      fetch(`${internalUrl}/api/brands`, { cache: "no-store" }).catch(() => null),
    ]);

    if (categoriesRes?.ok) {
      const categories = await categoriesRes.json();
      if (Array.isArray(categories)) {
        for (const c of categories) {
          if (c.slug && c.is_active !== false) {
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
          if (post.slug && post.is_published !== false) {
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

    if (brandsRes?.ok) {
      const brands = await brandsRes.json();
      if (Array.isArray(brands)) {
        for (const b of brands) {
          if (b.slug && b.is_active !== false) {
            entries.push({
              url: `${siteUrl}/brands/${b.slug}`,
              lastModified: new Date(),
              changeFrequency: "weekly",
              priority: 0.5,
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
