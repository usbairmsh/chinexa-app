export function OrganizationJsonLd() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ChineXa",
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description: "Premium beauty, skincare & lifestyle store in Bangladesh. Authentic Korean skincare, luxury bags, jewelry & imported beauty products.",
    address: {
      "@type": "PostalAddress",
      addressCountry: "BD",
      addressRegion: "Dhaka",
    },
    sameAs: [],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function WebsiteJsonLd() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ChineXa",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/products?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface ProductJsonLdProps {
  name: string;
  description: string;
  image: string;
  sku: string;
  price: number;
  highPrice?: number;
  /** Original ("was") price before discount, for the initial/default variant — renders as a strikethrough-style price comparison in Google's rich result. Ignored when highPrice is set, since an AggregateOffer range and a single "was/now" price aren't both expressible at once. */
  compareAtPrice?: number;
  currency?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  /** For PreOrder items — the date the product becomes available (YYYY-MM-DD). */
  availabilityStarts?: string;
  rating?: number;
  reviewCount?: number;
  /** A few real, approved reviews — emitted as schema.org Review objects so
   *  Google's product snippet has the individual reviews it wants alongside
   *  the aggregate rating. Only include genuine reviews; never fabricate. */
  reviews?: { author: string; rating: number; title?: string; body?: string; date?: string }[];
  brand?: string;
  category?: string;
  url: string;
}

export function ProductJsonLd({
  name, description, image, sku, price, highPrice, compareAtPrice, currency = "BDT",
  availability = "InStock", availabilityStarts, rating, reviewCount, reviews, brand, category, url,
}: ProductJsonLdProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
  const priceValidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const offers = highPrice && highPrice > price
    ? {
        "@type": "AggregateOffer",
        url: `${siteUrl}${url}`,
        priceCurrency: currency,
        lowPrice: price.toFixed(2),
        highPrice: highPrice.toFixed(2),
        offerCount: 2,
        availability: `https://schema.org/${availability}`,
        ...(availability === "PreOrder" && availabilityStarts ? { availabilityStarts } : {}),
        seller: { "@type": "Organization", name: "ChineXa" },
      }
    : {
        "@type": "Offer",
        url: `${siteUrl}${url}`,
        priceCurrency: currency,
        price: price.toFixed(2),
        priceValidUntil,
        // Google Merchant listing wants validFrom on the offer — the point the
        // current price became effective. It's rendered fresh each request, so
        // "now" is accurate for the price being shown.
        validFrom: new Date().toISOString(),
        availability: `https://schema.org/${availability}`,
        ...(availability === "PreOrder" && availabilityStarts ? { availabilityStarts } : {}),
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: "ChineXa" },
        // "Was X, now Y" per Google's Merchant Listing structured data spec:
        // the active price stays on Offer.price (unmarked), and only the
        // original/struck-through price goes in priceSpecification with
        // priceType: StrikethroughPrice — same discount already shown in the
        // storefront UI's price display.
        ...(compareAtPrice && compareAtPrice > price
          ? {
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                priceType: "https://schema.org/StrikethroughPrice",
                price: compareAtPrice.toFixed(2),
                priceCurrency: currency,
              },
            }
          : {}),
        shippingDetails: {
          "@type": "OfferShippingDetails",
          // Representative standard rate (lowest zone — Dhaka City, ৳60). A
          // concrete shippingRate is required by Google's Merchant listing;
          // exact per-zone cost is still computed at checkout.
          shippingRate: {
            "@type": "MonetaryAmount",
            value: 60,
            currency: currency,
          },
          shippingDestination: { "@type": "DefinedRegion", addressCountry: "BD" },
          deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" }, transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 5, unitCode: "DAY" } },
        },
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          // ISO 3166-1 alpha-2, as an array per Google's spec.
          applicableCountry: ["BD"],
          returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: 7,
          // Store's 7-day return is free to the customer.
          returnFees: "https://schema.org/FreeReturn",
          returnMethod: "https://schema.org/ReturnByMail",
        },
      };

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: description?.slice(0, 300),
    image: image.startsWith("http") ? image : `${siteUrl}${image}`,
    sku,
    brand: { "@type": "Brand", name: brand || "ChineXa" },
    category,
    offers,
  };

  if (rating && reviewCount) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating.toFixed(1),
      reviewCount,
      bestRating: "5",
      worstRating: "1",
    };
  }

  // Individual reviews — only real, approved ones. Google wants at least one
  // Review alongside the aggregateRating for a complete product snippet.
  // Never emit an empty or fabricated review: no reviews → no review field,
  // which is correct (and avoids a structured-data policy violation).
  if (reviews && reviews.length > 0) {
    schema.review = reviews.map((r) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: String(r.rating),
        bestRating: "5",
        worstRating: "1",
      },
      author: { "@type": "Person", name: r.author },
      ...(r.title ? { name: r.title } : {}),
      ...(r.body ? { reviewBody: r.body.slice(0, 500) } : {}),
      ...(r.date ? { datePublished: r.date } : {}),
    }));
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface BrandJsonLdProps {
  name: string;
  description: string;
  logo?: string;
  url: string;
  sameAs?: string[];
}

/** Marks a brand's storefront page as the Bangladesh source for that brand's products — same BD address/shipping signal ProductJsonLd already sends per-product, just at the brand-page level. */
export function BrandJsonLd({ name, description, logo, url, sameAs }: BrandJsonLdProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
  const fullLogo = logo ? (logo.startsWith("http") ? logo : `${siteUrl}${logo}`) : `${siteUrl}/logo.png`;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Brand",
    name,
    description: description?.slice(0, 300),
    logo: fullLogo,
    url: `${siteUrl}${url}`,
    // areaServed pins this brand's storefront presence to Bangladesh, same
    // signal as ProductJsonLd's shippingDestination — reinforces to Google
    // that this page is the BD-market source for the brand, not a generic
    // international listing.
    areaServed: { "@type": "Country", name: "Bangladesh" },
    ...(sameAs && sameAs.length > 0 ? { sameAs } : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

/** FAQPage rich-result markup — questions/answers must mirror the visible FAQ
 *  content exactly (both render from the same shared data). */
export function FaqJsonLd({ faqs }: { faqs: { q: string; a: string }[] }) {
  if (!faqs || faqs.length === 0) return null;
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
  );
}

interface LocalBusinessJsonLdProps {
  name?: string;
  phone?: string;
  address?: string;
}

/** LocalBusiness (Store) markup — the Dhaka-based business behind the site.
 *  Complements (does not replace) the Organization markup: Store carries the
 *  local signals (address, phone, geo region) Google uses for local intent
 *  queries like "cosmetics shop in Dhaka". */
export function LocalBusinessJsonLd({ name, phone, address }: LocalBusinessJsonLdProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: name || "ChineXa",
    url: siteUrl,
    image: `${siteUrl}/logo.png`,
    ...(phone ? { telephone: phone } : {}),
    address: {
      "@type": "PostalAddress",
      ...(address ? { streetAddress: address } : {}),
      addressLocality: "Dhaka",
      addressCountry: "BD",
    },
    priceRange: "৳৳",
    currenciesAccepted: "BDT",
    paymentAccepted: "Cash on Delivery, bKash, Nagad, Rocket, Credit Card",
    areaServed: { "@type": "Country", name: "Bangladesh" },
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
  );
}

interface ItemListEntry {
  name: string;
  url: string;
}

/** ItemList markup for category/collection listing pages — tells Google the
 *  page is a product list and which product URLs it contains. */
export function ItemListJsonLd({ items, listName }: { items: ItemListEntry[]; listName?: string }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
  if (!items || items.length === 0) return null;
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    ...(listName ? { name: listName } : {}),
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url.startsWith("http") ? item.url : `${siteUrl}${item.url}`,
    })),
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
  );
}

interface ArticleJsonLdProps {
  title: string;
  description?: string;
  image?: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
}

/** BlogPosting markup for blog articles — the OG tags already exist; this adds
 *  the structured-data layer Google uses for article rich results. */
export function ArticleJsonLd({ title, description, image, url, datePublished, dateModified, authorName }: ArticleJsonLdProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    ...(description ? { description: description.slice(0, 300) } : {}),
    ...(image ? { image: image.startsWith("http") ? image : `${siteUrl}${image}` } : {}),
    mainEntityOfPage: url.startsWith("http") ? url : `${siteUrl}${url}`,
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    author: { "@type": "Organization", name: authorName || "ChineXa" },
    publisher: {
      "@type": "Organization",
      name: "ChineXa",
      logo: { "@type": "ImageObject", url: `${siteUrl}/logo.png` },
    },
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
  );
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${siteUrl}${item.url}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
