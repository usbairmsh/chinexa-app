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
  currency?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  rating?: number;
  reviewCount?: number;
  brand?: string;
  category?: string;
  url: string;
}

export function ProductJsonLd({
  name, description, image, sku, price, highPrice, currency = "BDT",
  availability = "InStock", rating, reviewCount, brand, category, url,
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
        seller: { "@type": "Organization", name: "ChineXa" },
      }
    : {
        "@type": "Offer",
        url: `${siteUrl}${url}`,
        priceCurrency: currency,
        price: price.toFixed(2),
        priceValidUntil,
        availability: `https://schema.org/${availability}`,
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: "ChineXa" },
        shippingDetails: {
          "@type": "OfferShippingDetails",
          shippingDestination: { "@type": "DefinedRegion", addressCountry: "BD" },
          deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" }, transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 5, unitCode: "DAY" } },
        },
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: 7,
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
