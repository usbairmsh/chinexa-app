import type { Metadata } from "next";

// Search result pages are infinite thin-content variations — never index them.
export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
