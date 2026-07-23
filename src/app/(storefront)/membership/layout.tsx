import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// Metadata-only layout: the page itself is a client component and previously
// inherited just the generic site-wide title. Children pass through untouched.
const defaultMetadata: Metadata = {
  title: "Membership & Loyalty Rewards — Earn Points on Every Order",
  description:
    "Join the ChineXa membership program in Bangladesh — earn loyalty points on every purchase of skincare, bags, jewellery, perfumes & shoes, unlock tiers and redeem exclusive rewards.",
  alternates: { canonical: "/membership", languages: { "en-BD": "/membership" } },
  openGraph: {
    title: "ChineXa Membership & Rewards",
    description: "Earn points on every order and unlock exclusive tier benefits at ChineXa Bangladesh.",
  },
};

// Admin overrides (SEO Management → Page Meta) apply on top of these defaults.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/membership", defaultMetadata);
}

export default function MembershipLayout({ children }: { children: React.ReactNode }) {
  return children;
}
