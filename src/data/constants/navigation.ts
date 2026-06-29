export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
  badge?: string;
  featured?: boolean;
}

export const MAIN_NAV: NavItem[] = [
  {
    label: "Skincare",
    href: "/categories/skincare",
    children: [
      { label: "Serums", href: "/categories/skincare?sub=serums" },
      { label: "Moisturizers", href: "/categories/skincare?sub=moisturizers" },
      { label: "Cleansers", href: "/categories/skincare?sub=cleansers" },
      { label: "Face Masks", href: "/categories/skincare?sub=masks" },
      { label: "Toners", href: "/categories/skincare?sub=toners" },
      { label: "Sunscreen", href: "/categories/skincare?sub=sunscreen" },
      { label: "Shop All Skincare", href: "/categories/skincare", featured: true },
    ],
  },
  {
    label: "Bags",
    href: "/categories/bags",
    children: [
      { label: "Handbags", href: "/categories/bags?sub=handbags" },
      { label: "Clutches", href: "/categories/bags?sub=clutches" },
      { label: "Tote Bags", href: "/categories/bags?sub=tote-bags" },
      { label: "Crossbody", href: "/categories/bags?sub=crossbody" },
      { label: "Shop All Bags", href: "/categories/bags", featured: true },
    ],
  },
  {
    label: "Jewels",
    href: "/categories/jewels",
    children: [
      { label: "Necklaces", href: "/categories/jewels?sub=necklaces" },
      { label: "Earrings", href: "/categories/jewels?sub=earrings" },
      { label: "Rings", href: "/categories/jewels?sub=rings" },
      { label: "Bracelets", href: "/categories/jewels?sub=bracelets" },
      { label: "Sets", href: "/categories/jewels?sub=sets" },
      { label: "Shop All Jewels", href: "/categories/jewels", featured: true },
    ],
  },
  {
    label: "Perfumes",
    href: "/categories/perfumes",
    children: [
      { label: "Eau de Parfum", href: "/categories/perfumes?sub=edp" },
      { label: "Eau de Toilette", href: "/categories/perfumes?sub=edt" },
      { label: "Body Mists", href: "/categories/perfumes?sub=body-mists" },
      { label: "Gift Sets", href: "/categories/perfumes?sub=gift-sets" },
      { label: "Shop All Perfumes", href: "/categories/perfumes", featured: true },
    ],
  },
  {
    label: "Shoes",
    href: "/categories/shoes",
    children: [
      { label: "Heels", href: "/categories/shoes?sub=heels" },
      { label: "Flats", href: "/categories/shoes?sub=flats" },
      { label: "Sandals", href: "/categories/shoes?sub=sandals" },
      { label: "Wedges", href: "/categories/shoes?sub=wedges" },
      { label: "Shop All Shoes", href: "/categories/shoes", featured: true },
    ],
  },
  {
    label: "Imported",
    href: "/categories/imported",
    badge: "Exclusive",
  },
  {
    label: "Pre-Order",
    href: "/categories/pre-orders",
    badge: "New",
  },
];

export const FOOTER_LINKS = {
  shop: {
    title: "Shop",
    links: [
      { label: "New Arrivals", href: "/collections/new-arrivals" },
      { label: "Best Sellers", href: "/collections/bestsellers" },
      { label: "Skincare", href: "/categories/skincare" },
      { label: "Bags", href: "/categories/bags" },
      { label: "Jewels", href: "/categories/jewels" },
      { label: "Perfumes", href: "/categories/perfumes" },
      { label: "Pre-Orders", href: "/categories/pre-orders" },
    ],
  },
  help: {
    title: "Help",
    links: [
      { label: "FAQ", href: "/faq" },
      { label: "Shipping", href: "/policies/shipping" },
      { label: "Returns", href: "/policies/returns" },
      { label: "Track Order", href: "/track-order" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
  about: {
    title: "About",
    links: [
      { label: "Our Story", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Privacy Policy", href: "/policies/privacy" },
      { label: "Terms of Service", href: "/policies/terms" },
    ],
  },
};
