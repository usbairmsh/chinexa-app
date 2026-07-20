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
    { url: `${siteUrl}/membership`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
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
    // Products — paginate until every page has been fetched, not a fixed
    // page count, so the sitemap never silently truncates as the catalog
    // grows past whatever cap a hardcoded loop bound would impose.
    let page = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
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
      page++;
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
  } catch (err) {
    // If APIs fail, still return the static pages rather than a hard error —
    // but log it, since a silently-broken sitemap (e.g. DB down, internal
    // fetch misconfigured) would otherwise serve a near-empty sitemap to
    // Google indefinitely with zero visibility into why.
    console.error("[sitemap] failed to load dynamic entries:", err);
  }

  // Drop any page the admin marked noindex (SEO Management → Page Meta) — a
  // sitemap must never advertise URLs that carry a noindex tag, or Search
  // Console flags the contradiction ("Sitemap contains noindexed URL").
  try {
    const seoRes = await fetch(`${internalUrl}/api/seo`, { cache: "no-store" }).catch(() => null);
    if (seoRes?.ok) {
      const rows = await seoRes.json();
      if (Array.isArray(rows)) {
        const noIndexPaths = new Set(
          rows.filter((r) => r.no_index).map((r) => r.page_path as string)
        );
        if (noIndexPaths.size > 0) {
          return entries.filter((e) => {
            try { return !noIndexPaths.has(new URL(e.url).pathname); } catch { return true; }
          });
        }
      }
    }
  } catch {}

  return entries;
}
