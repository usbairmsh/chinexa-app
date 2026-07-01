import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Beauty Blog — Tips, Guides & Trends",
  description: "Expert beauty tips, Korean skincare guides, product reviews & trending looks. Stay updated with the latest beauty trends from ChineXa.",
  alternates: { canonical: "/blog" },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
