import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

const defaultMetadata: Metadata = {
  title: "Our Brands — Authentic International Beauty Brands",
  description:
    "Explore the authentic international brands available at ChineXa — Korean skincare, luxury fashion, and premium beauty brands, all genuine and sourced from authorised suppliers.",
  alternates: { canonical: "/brands" },
};

// Admin overrides (SEO Management -> Page Meta) apply on top of these defaults.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/brands", defaultMetadata);
}

export default function BrandsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
