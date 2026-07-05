import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Track Your Order",
  description: "Track your ChineXa order status in real time using your order number or phone number.",
  alternates: { canonical: "/track-order" },
};

export default function TrackOrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
