import { NextResponse } from "next/server";

export const dynamic = "force-static";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

// RFC 9727 API catalog document — a Linkset (RFC 9264) describing this site's
// one public REST API. `anchor` identifies the API itself (its base path),
// not the catalog document — per RFC 9727 Appendix A, each linkset entry is
// one API, described via service-desc/service-doc/status link relations.
//
// service-desc (OpenAPI spec) and status (health endpoint) are deliberately
// omitted rather than faked: no OpenAPI document exists for this API today,
// and the only health-check route (/api/db/health) is an internal
// admin-facing endpoint that reflects DB schema details — not a safe public
// status signal. Add both for real before including those relations.
//
// Every mutating endpoint and every admin/customer-authenticated endpoint is
// intentionally excluded from `item` — none of them are safe for an anonymous
// agent to call, since this app has no server-side session verification (see
// src/app/api/products/[id]/route.ts's cost_price handling for related context).
export async function GET() {
  const linkset = [
    {
      anchor: `${siteUrl}/api`,
      "service-doc": [{ href: `${siteUrl}/sitemap.xml`, type: "application/xml" }],
      item: [
        { href: `${siteUrl}/api/products`, title: "Product listing (search, category, brand filters)" },
        { href: `${siteUrl}/api/categories`, title: "Category list" },
        { href: `${siteUrl}/api/brands`, title: "Brand list" },
        { href: `${siteUrl}/api/blog`, title: "Published blog posts" },
        { href: `${siteUrl}/api/search/trending`, title: "Trending search terms" },
        { href: `${siteUrl}/api/membership/tiers`, title: "Membership tier definitions" },
      ],
    },
  ];

  return NextResponse.json(
    { linkset },
    { headers: { "Content-Type": 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"' } }
  );
}
