import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

const defaultMetadata: Metadata = {
  title: "FAQ — Frequently Asked Questions",
  description: "Find answers to common questions about orders, shipping, returns, payments & more at ChineXa. Free delivery, cash on delivery & 7-day return policy.",
  alternates: { canonical: "/faq" },
};

// Admin overrides (SEO Management -> Page Meta) apply on top of these defaults.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/faq", defaultMetadata);
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
