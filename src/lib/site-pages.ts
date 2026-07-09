/**
 * The set of pages a footer link (or any other admin-configurable link) can
 * point to. Static pages and collections are fixed site mechanisms — the
 * routes themselves are code, not admin data — but everything the admin
 * actually manages (categories, policy pages) is listed dynamically so new
 * ones show up here automatically.
 */
export interface SitePageOption {
  label: string;
  href: string;
}

export interface SitePageGroup {
  group: string;
  options: SitePageOption[];
}

export const STATIC_PAGES: SitePageOption[] = [
  { label: "Home", href: "/" },
  { label: "All Products", href: "/products" },
  { label: "All Brands", href: "/brands" },
  { label: "About / Our Story", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact Us", href: "/contact" },
  { label: "Track Order", href: "/track-order" },
  { label: "Membership Benefits", href: "/membership" },
  { label: "Cart", href: "/cart" },
  { label: "Wishlist", href: "/wishlist" },
];

export const COLLECTION_PAGES: SitePageOption[] = [
  { label: "New Arrivals", href: "/collections/new-arrivals" },
  { label: "Best Sellers", href: "/collections/bestsellers" },
  { label: "Trending Now", href: "/collections/trending" },
];

/** Not a real page — opens the help chat widget instead of navigating. */
export const CHAT_ACTION: SitePageOption = { label: "Open Help Chat", href: "#chat" };
