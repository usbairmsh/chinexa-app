import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About ChineXa — Our Story & Mission",
  description: "Learn about ChineXa, Bangladesh's premium beauty & lifestyle destination. We bring world-class skincare, luxury bags, jewelry & perfumes to your doorstep.",
  alternates: { canonical: "/about" },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
