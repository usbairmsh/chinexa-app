import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          // Storefront pages fetch their own visible content (name, price,
          // images, description) client-side from these read-only GET
          // endpoints. Googlebot's renderer respects robots.txt for the
          // resources it loads while rendering a page — with these blocked
          // under the blanket /api/ disallow below, Googlebot could reach
          // the page shell but never complete the fetch that fills it in,
          // leaving what looks like an empty page for indexing purposes.
          // Only read-only, public-data endpoints are allowed here; every
          // mutating/private endpoint (orders, customers, auth, admin, cart,
          // chat, etc.) stays blocked by the /api/ disallow.
          "/api/products",
          "/api/products/*",
          "/api/categories",
          "/api/categories/*",
          "/api/brands",
          "/api/brands/*",
          "/api/blog",
          "/api/blog/*",
          "/api/reviews",
          "/api/settings",
          "/api/search/trending",
        ],
        // Private/transactional areas. NOTE: /cart, /search, /wishlist, /login are
        // intentionally NOT disallowed — they carry a noindex meta tag instead,
        // which Google can only see if it is allowed to crawl them.
        disallow: ["/admin/", "/admin", "/api/", "/dashboard/", "/dashboard", "/checkout", "/verify", "/register", "/invoice"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
