export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

// llms.txt — a Markdown guide for AI search engines / LLM crawlers (the
// emerging GEO convention, https://llmstxt.org). Points them at the store's key
// entry points and states what ChineXa is, so LLM answers cite it correctly.
export async function GET() {
  const body = `# ChineXa

> ChineXa is a premium beauty, skincare & lifestyle store in Bangladesh. We sell
> authentic Korean skincare (K-beauty), luxury bags, jewelry, perfumes and
> imported beauty products, with genuine-product guarantees, cash on delivery,
> and fast nationwide shipping.

## Key pages

- [All products](${siteUrl}/products): Full catalogue of skincare, beauty, bags, jewelry & perfumes.
- [Brands](${siteUrl}/brands): Shop by brand — Korean and international beauty labels.
- [Blog](${siteUrl}/blog): Skincare guides, ingredient explainers and beauty tips.
- [Track order](${siteUrl}/track-order): Look up an order's delivery status.
- [Membership](${siteUrl}/membership): Loyalty tiers, points and member benefits.

## About

- Market: Bangladesh (nationwide delivery; based in Dhaka).
- Payments: Cash on Delivery, bKash, Nagad, Rocket, card.
- Currency: BDT (৳).
- Returns: 7-day return policy.

## Machine-readable

- [Sitemap](${siteUrl}/sitemap.xml)
- Structured data (schema.org Product, Organization, LocalBusiness, Breadcrumb) is embedded as JSON-LD on the relevant pages.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
