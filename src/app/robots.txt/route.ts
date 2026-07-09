export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

// Storefront pages fetch their own visible content (name, price, images,
// description) client-side from these read-only GET endpoints. Googlebot's
// renderer respects robots.txt for the resources it loads while rendering a
// page — with these blocked under the blanket /api/ disallow below, Googlebot
// could reach the page shell but never complete the fetch that fills it in,
// leaving what looks like an empty page for indexing purposes. Only
// read-only, public-data endpoints are allowed here; every mutating/private
// endpoint (orders, customers, auth, admin, cart, chat, etc.) stays blocked
// by the /api/ disallow.
const PUBLIC_API_ALLOW = [
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
];

// Private/transactional areas. NOTE: /cart, /search, /wishlist, /login are
// intentionally NOT disallowed — they carry a noindex meta tag instead, which
// Google can only see if it is allowed to crawl them. /md/ is the internal
// Markdown-negotiation rewrite target (see src/proxy.ts) — reached only via
// Accept: text/markdown, never a real page to crawl.
const DISALLOW = ["/admin/", "/admin", "/api/", "/dashboard/", "/dashboard", "/checkout", "/verify", "/register", "/invoice", "/md/"];

export async function GET() {
  const lines = [
    "User-agent: *",
    "Allow: /",
    ...PUBLIC_API_ALLOW.map((p) => `Allow: ${p}`),
    ...DISALLOW.map((p) => `Disallow: ${p}`),
    // Content Signals (draft-romm-aipref-contentsignals): stay indexed for
    // search as today, but opt this content out of AI training sets and
    // AI-input/RAG use — declared explicitly rather than left to per-crawler
    // guesswork. See https://contentsignals.org/
    "Content-Signal: ai-train=no, search=yes, ai-input=no",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
  ];

  return new Response(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
