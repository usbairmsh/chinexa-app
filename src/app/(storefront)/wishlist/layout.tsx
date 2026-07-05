import type { Metadata } from "next";

// Wishlist is per-user local state — never index it.
export const metadata: Metadata = {
  title: "My Wishlist",
  robots: { index: false, follow: true },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
