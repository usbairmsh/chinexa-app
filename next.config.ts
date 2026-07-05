import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.0.*"],
  images: {
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
};

export default nextConfig;
