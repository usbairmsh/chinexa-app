import type { NextConfig } from "next";
import withBundleAnalyzerInit from "@next/bundle-analyzer";

const withBundleAnalyzer = withBundleAnalyzerInit({ enabled: process.env.ANALYZE === "true" });

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.0.*"],
  images: {
    formats: ["image/avif", "image/webp"],
    // Tuned for this storefront's actual layout: product-grid cells render at
    // ~50vw (phones) / 33vw / 25vw and the detail gallery at ~800px, so the
    // default 16-entry srcset wastes variants. Smaller, better-fitting sizes =
    // smaller downloads on the cheap Android devices that dominate BD traffic.
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [36, 48, 64, 96, 128, 256, 384],
    // Uploaded product images get unique filenames (never overwritten in
    // place), so optimized variants can be cached for 30 days instead of the
    // 60-second default — cuts repeat re-optimization work on the VPS.
    minimumCacheTTL: 2592000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
  async redirects() {
    return [
      // Canonical host: www.chinexabd.com -> chinexabd.com (apex), 301.
      // Every canonical, sitemap entry, and JSON-LD URL already uses the apex
      // domain, but www was still served 200 with no redirect — so the whole
      // site was crawlable under both hosts (duplicate content, and why Search
      // Console reported URLs under both variants). This app-level rule holds
      // even if Caddy (the primary redirect layer) is bypassed/misconfigured,
      // matching the "fallback" reasoning on the headers() below. Preserves the
      // full path + query via :path*.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.chinexabd.com" }],
        destination: "https://chinexabd.com/:path*",
        permanent: true,
      },
      // Category slug typo fix ("makups" -> "makeup"). Google already crawled
      // the misspelled URL from the sitemap, so a permanent redirect preserves
      // any indexing/link value instead of leaving a 404 behind.
      {
        source: "/categories/makups",
        destination: "/categories/makeup",
        permanent: true,
      },
    ];
  },
  // App-level fallback so these hold even if Caddy (the primary layer, on the
  // VPS) is ever bypassed or misconfigured. CSP and HSTS are deliberately kept
  // Caddy-only — CSP needs iterative tuning against real browser console output
  // and HSTS should be set as close to the TLS termination point as possible.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // Payment links must NEVER be cached by any layer. The URL itself is a
      // capability, so a cached copy at the Cloudflare edge could serve one
      // customer's order (and its Pay button) to a different visitor. This is
      // belt-and-braces alongside the routes' own `dynamic = "force-dynamic"`
      // and no-store, because Cloudflare has ignored Vary on this site before.
      {
        source: "/pay/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
          // Keep the token out of the Referer on the hop to the payment gateway.
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/api/pay/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
        ],
      },
      // RFC 8288 Link header on the homepage so agents/crawlers can discover
      // the read-only API catalog (RFC 9727) without guessing at endpoints.
      {
        source: "/",
        headers: [
          { key: "Link", value: '</.well-known/api-catalog>; rel="api-catalog", </sitemap.xml>; rel="service-doc"' },
        ],
      },
      // Long cache lifetimes for immutable-ish static assets (fixes PageSpeed's
      // "efficient cache lifetimes"). Favicons/logo rarely change; uploaded
      // media files are content-addressed (unique filenames, never overwritten).
      {
        source: "/favicon/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:file(logo\\.png|favicon\\.ico|apple-touch-icon\\.png)",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
      {
        source: "/api/uploads/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, immutable" }],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
