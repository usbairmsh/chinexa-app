import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private/transactional areas. NOTE: /cart, /search, /wishlist, /login are
        // intentionally NOT disallowed — they carry a noindex meta tag instead,
        // which Google can only see if it is allowed to crawl them.
        disallow: ["/admin/", "/admin", "/api/", "/dashboard/", "/dashboard", "/checkout", "/verify", "/register", "/invoice"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
