import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

const COLLECTION_META: Record<string, { title: string; description: string }> = {
  "new-arrivals": {
    title: "New Arrivals — Latest Beauty & Lifestyle Products",
    description: "The latest additions to the ChineXa collection — be the first to discover fresh Korean skincare, bags, jewelry and beauty finds in Bangladesh.",
  },
  bestsellers: {
    title: "Best Sellers — Most Loved Beauty Products",
    description: "ChineXa's most loved products — tried, tested, and adored. Shop the bestselling skincare, bags, perfumes and jewelry in Bangladesh.",
  },
  trending: {
    title: "Trending Now — Hottest Beauty Products",
    description: "What everyone is talking about — the hottest beauty and lifestyle products of the season, available in Bangladesh with cash on delivery.",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const meta = COLLECTION_META[slug];
  if (!meta) {
    // Unknown collection slugs must not be indexed (thin/empty pages)
    return { title: "Collection Not Found", robots: { index: false, follow: true } };
  }
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `${siteUrl}/collections/${slug}` },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${siteUrl}/collections/${slug}`,
      type: "website",
    },
  };
}

export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
