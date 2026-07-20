import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

const defaultMetadata: Metadata = {
  title: "Contact Us — ChineXa Customer Support",
  description: "Get in touch with ChineXa. We're here to help with orders, products, returns & general inquiries. Fast response from our Dhaka-based support team.",
  alternates: { canonical: "/contact" },
};

// Admin overrides (SEO Management -> Page Meta) apply on top of these defaults.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/contact", defaultMetadata);
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
