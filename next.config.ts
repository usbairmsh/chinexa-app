import type { NextConfig } from "next";
import withBundleAnalyzerInit from "@next/bundle-analyzer";

const withBundleAnalyzer = withBundleAnalyzerInit({ enabled: process.env.ANALYZE === "true" });

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.0.*"],
  images: {
    formats: ["image/avif", "image/webp"],
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
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
