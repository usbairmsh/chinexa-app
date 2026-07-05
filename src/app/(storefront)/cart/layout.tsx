import type { Metadata } from "next";

// Cart is a session-specific utility page — never index it.
export const metadata: Metadata = {
  title: "Shopping Bag",
  robots: { index: false, follow: true },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
