import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

const defaultMetadata: Metadata = {
  title: "About ChineXa — Our Story & Mission",
  description: "Learn about ChineXa, Bangladesh's premium beauty & lifestyle destination. We bring world-class skincare, luxury bags, jewelry & perfumes to your doorstep.",
  alternates: { canonical: "/about" },
};

// Admin overrides (SEO Management -> Page Meta) apply on top of these defaults.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/about", defaultMetadata);
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
