import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us — ChineXa Customer Support",
  description: "Get in touch with ChineXa. We're here to help with orders, products, returns & general inquiries. Fast response from our Dhaka-based support team.",
  alternates: { canonical: "/contact" },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
