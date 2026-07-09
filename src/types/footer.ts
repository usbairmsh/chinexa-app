export interface FooterLink {
  id: string;
  /** Text shown to the visitor — independently editable from the destination. */
  label: string;
  /** Where this link points. "#chat" is a special value that opens the help chat widget instead of navigating. */
  href: string;
}

export interface FooterColumn {
  id: string;
  title: string;
  links: FooterLink[];
}

export interface FooterConfig {
  columns: FooterColumn[];
}

export const DEFAULT_FOOTER_CONFIG: FooterConfig = {
  columns: [
    {
      id: "col-shop", title: "Shop", links: [
        { id: "l1", label: "New Arrivals", href: "/collections/new-arrivals" },
        { id: "l2", label: "Best Sellers", href: "/collections/bestsellers" },
        { id: "l3", label: "Skincare", href: "/categories/skincare" },
        { id: "l4", label: "Bags", href: "/categories/bags" },
        { id: "l5", label: "Jewels", href: "/categories/jewels" },
        { id: "l6", label: "Perfumes", href: "/categories/perfumes" },
        { id: "l7", label: "Pre-Orders", href: "/categories/pre-orders" },
      ],
    },
    {
      id: "col-help", title: "Help", links: [
        { id: "l8", label: "Get Help", href: "#chat" },
        { id: "l9", label: "FAQ", href: "/faq" },
        { id: "l10", label: "Shipping", href: "/policies/shipping" },
        { id: "l11", label: "Returns", href: "/policies/returns" },
        { id: "l12", label: "Track Order", href: "/track-order" },
        { id: "l13", label: "Contact Us", href: "/contact" },
      ],
    },
    {
      id: "col-about", title: "About", links: [
        { id: "l14", label: "Our Story", href: "/about" },
        { id: "l15", label: "Blog", href: "/blog" },
        { id: "l16", label: "Membership Benefits", href: "/membership" },
        { id: "l17", label: "Privacy Policy", href: "/policies/privacy" },
        { id: "l18", label: "Terms of Service", href: "/policies/terms" },
      ],
    },
  ],
};
