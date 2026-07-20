import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

const defaultMetadata: Metadata = {
  title: "Beauty Blog — Tips, Guides & Trends",
  description: "Expert beauty tips, Korean skincare guides, product reviews & trending looks. Stay updated with the latest beauty trends from ChineXa.",
  alternates: { canonical: "/blog" },
};

// Admin overrides (SEO Management -> Page Meta) apply on top of these defaults.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/blog", defaultMetadata);
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
