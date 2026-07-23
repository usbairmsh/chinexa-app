import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// Metadata-only layout: the page itself is a client component and previously
// inherited just the generic site-wide title — invisible to search engines as
// its own page. Children pass through untouched.
const defaultMetadata: Metadata = {
  title: "Exclusive Collection — Handpicked Products in Bangladesh",
  description:
    "Shop ChineXa's exclusive collection in Bangladesh — handpicked skincare, bags, jewellery, perfumes, shoes & imported products. 100% original, cash on delivery across BD.",
  alternates: { canonical: "/exclusive", languages: { "en-BD": "/exclusive" } },
  openGraph: {
    title: "Exclusive Collection — ChineXa Bangladesh",
    description: "Handpicked exclusive products — original skincare, bags, jewellery, perfumes & more with COD across Bangladesh.",
  },
};

// Admin overrides (SEO Management → Page Meta) apply on top of these defaults.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/exclusive", defaultMetadata);
}

export default function ExclusiveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
