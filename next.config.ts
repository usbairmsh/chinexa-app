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
      // RFC 8288 Link header on the homepage so agents/crawlers can discover
      // the read-only API catalog (RFC 9727) without guessing at endpoints.
      {
        source: "/",
        headers: [
          { key: "Link", value: '</.well-known/api-catalog>; rel="api-catalog", </sitemap.xml>; rel="service-doc"' },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
