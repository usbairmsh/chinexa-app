import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our Brands — Authentic International Beauty Brands",
  description:
    "Explore the authentic international brands available at ChineXa — Korean skincare, luxury fashion, and premium beauty brands, all genuine and sourced from authorised suppliers.",
  alternates: { canonical: "/brands" },
};

export default function BrandsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
