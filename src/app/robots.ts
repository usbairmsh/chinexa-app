import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/dashboard/", "/checkout", "/verify", "/register"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
