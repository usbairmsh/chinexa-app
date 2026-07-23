import type { Metadata } from "next";
import { pageMetadata, getSchemaConfig } from "@/lib/seo";
import { FaqJsonLd } from "@/components/seo/json-ld";
import { faqSections } from "@/data/faq";

const defaultMetadata: Metadata = {
  title: "FAQ — Frequently Asked Questions",
  description: "Find answers to common questions about orders, shipping, returns, payments & more at ChineXa. Free delivery, cash on delivery & 7-day return policy.",
  alternates: { canonical: "/faq" },
};

// Admin overrides (SEO Management -> Page Meta) apply on top of these defaults.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/faq", defaultMetadata);
}

export default async function FaqLayout({ children }: { children: React.ReactNode }) {
  // FAQPage rich-result markup, built from the same shared data the page
  // renders (so visible answers and structured data can't drift). Admin-
  // toggleable via SEO Management → Schema.
  const schema = await getSchemaConfig();
  return (
    <>
      {schema.faq && <FaqJsonLd faqs={faqSections.flatMap((s) => s.faqs)} />}
      {children}
    </>
  );
}
