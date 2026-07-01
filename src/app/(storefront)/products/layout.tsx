import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop All Products — Premium Beauty & Lifestyle",
  description: "Browse our complete collection of authentic Korean skincare, luxury bags, exquisite jewelry, fine perfumes & imported beauty products. Free delivery on orders over ৳3,000.",
  alternates: { canonical: "/products" },
  openGraph: {
    title: "Shop All Products — ChineXa",
    description: "Browse authentic Korean skincare, luxury bags, jewelry, perfumes & imported beauty products.",
  },
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
