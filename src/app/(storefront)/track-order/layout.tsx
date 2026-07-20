import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

const defaultMetadata: Metadata = {
  title: "Track Your Order",
  description: "Track your ChineXa order status in real time using your order number or phone number.",
  alternates: { canonical: "/track-order" },
};

// Admin overrides (SEO Management -> Page Meta) apply on top of these defaults.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/track-order", defaultMetadata);
}

export default function TrackOrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
