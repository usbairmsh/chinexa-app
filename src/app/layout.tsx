import type { Metadata, Viewport } from "next";
import { fraunces, manrope } from "@/lib/fonts";
import { Providers } from "@/providers";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { CookieConsent } from "@/components/shared/cookie-consent";
import { ChatWidget } from "@/components/shared/chat-widget-lazy";
import { ServiceWorkerRegister } from "@/components/shared/sw-register";
import { RouteScrollReset } from "@/components/shared/route-scroll-reset";
import { TrackingScripts } from "@/components/shared/tracking-scripts";
import { ImageProtection } from "@/components/shared/image-protection";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale/userScalable lock: disabling pinch-zoom is an accessibility
  // failure Lighthouse penalizes ("[user-scalable=no] is used") and Google
  // factors page experience into ranking. Modern browsers already prevent the
  // old iOS input-zoom quirk this lock was typically added for.
  // Browser-chrome / installed-app title-bar tint, matched to the palette and
  // switched by the device's OS theme: pearl in light, warm plum-black in dark
  // (the same --color-background values used by globals.css). This reacts to
  // prefers-color-scheme (the OS setting) rather than the in-app class toggle,
  // which the browser chrome can't read — the standard PWA approach.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF8FB" },
    { media: "(prefers-color-scheme: dark)", color: "#241820" },
  ],
};

// Kept ≤60 chars so search engines don't truncate it. Leads with the strongest
// keywords (Korean skincare / beauty / Bangladesh).
const DEFAULT_TITLE = "ChineXa — Korean Skincare & Beauty Store Bangladesh";
// Kept within Google's 120–160 char display window.
const DEFAULT_DESCRIPTION =
  "Shop authentic Korean skincare, luxury bags, jewelry, perfumes & imported beauty in Bangladesh. Genuine products, cash on delivery & fast nationwide shipping.";

export async function generateMetadata(): Promise<Metadata> {
  // Pull admin-managed SEO overrides + verification codes (best-effort; fall
  // back to defaults). getSeoOverride/getTrackingConfig are request-cached, so
  // these dedupe with the body's TrackingScripts read of the same config.
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let ogImageUrl = `${siteUrl}/logo.png`;
  let googleVerification: string | undefined;
  let bingVerification: string | undefined;
  let pinterestVerification: string | undefined;
  let metaDomainVerify: string | undefined;
  try {
    const { getSeoOverride, getTrackingConfig } = await import("@/lib/seo");
    const [globalRow, tracking] = await Promise.all([getSeoOverride("_global"), getTrackingConfig()]);
    if (globalRow) {
      if (globalRow.title) title = globalRow.title;
      if (globalRow.meta_description) description = globalRow.meta_description;
      if (globalRow.og_image) {
        ogImageUrl = globalRow.og_image.startsWith("http") ? globalRow.og_image : `${siteUrl}${globalRow.og_image}`;
      }
    }
    if (tracking.search_console) googleVerification = tracking.search_console;
    if (tracking.bing_verify) bingVerification = tracking.bing_verify;
    if (tracking.pinterest_verify) pinterestVerification = tracking.pinterest_verify;
    if (tracking.meta_domain_verify) metaDomainVerify = tracking.meta_domain_verify;
  } catch {}

  const otherVerification: Record<string, string> = {};
  if (bingVerification) otherVerification["msvalidate.01"] = bingVerification;
  if (pinterestVerification) otherVerification["p:domain_verify"] = pinterestVerification;
  // Meta domain verification — required to configure Aggregated Event
  // Measurement (iOS conversions) and domain-restricted catalog ads.
  if (metaDomainVerify) otherVerification["facebook-domain-verification"] = metaDomainVerify;

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: "%s | ChineXa",
    },
    description,
    keywords: [
      "ChineXa", "chinexabd", "premium beauty Bangladesh", "Korean skincare Bangladesh",
      "luxury bags", "jewelry", "perfumes", "beauty products Bangladesh",
      "imported skincare", "K-beauty Bangladesh", "online beauty store Bangladesh",
      "cosmetics BD", "original skincare products", "cash on delivery beauty",
    ],
    authors: [{ name: "ChineXa", url: siteUrl }],
    creator: "ChineXa",
    publisher: "ChineXa",
    formatDetection: { telephone: true, email: true },
    // NOTE: no site-wide `alternates.canonical` here. A global canonical made every
    // page declare the HOMEPAGE as its canonical, so Google refused to index them
    // ("Alternate page with proper canonical tag"). Each page sets its own canonical.
    openGraph: {
      type: "website",
      locale: "en_US",
      url: siteUrl,
      siteName: "ChineXa",
      title: "ChineXa — Premium Beauty & Lifestyle Store in Bangladesh",
      description:
        "Shop authentic Korean skincare, luxury bags, jewelry, perfumes & imported beauty products. Free delivery on ৳3,000+.",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: "ChineXa — Premium Beauty & Lifestyle",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "ChineXa — Premium Beauty & Lifestyle",
      description:
        "Shop authentic Korean skincare, luxury bags, jewelry & imported beauty products in Bangladesh.",
      images: [ogImageUrl],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    verification: googleVerification || Object.keys(otherVerification).length > 0
      ? {
          ...(googleVerification ? { google: googleVerification } : {}),
          ...(Object.keys(otherVerification).length > 0 ? { other: otherVerification } : {}),
        }
      : undefined,
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { url: "/favicon/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/favicon/apple-touch-icon.png",
      shortcut: "/favicon.ico",
    },
    // Served by src/app/manifest.ts at /manifest.webmanifest — has the fields
    // (id, scope, maskable icons) Chrome/Android require to offer installation.
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "ChineXa",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${fraunces.variable} ${manrope.variable} h-full antialiased`}
    >
      <head>
        {/* No-flash theme init — runs before first paint, so a dark-mode user
            never sees a white flash on load. Reads the same "chinexa-theme"
            localStorage key the theme store persists to, sets the .dark class
            on <html>, and pre-tints the splash loader below to match. Kept
            tiny and dependency-free; wrapped in try/catch so a blocked
            localStorage never breaks rendering. */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try{
              var raw=localStorage.getItem('chinexa-theme');
              var t='light';
              if(raw){var p=JSON.parse(raw);t=(p&&p.state&&p.state.theme)||'light';}
              if(t==='dark'){document.documentElement.classList.add('dark');}
            }catch(e){}
          })();
        ` }} />
      </head>
      <body className="min-h-full flex flex-col font-body text-charcoal bg-background">
        {/* Splash loader removed — pages now paint their real content as it
            arrives instead of hiding everything behind a spinner first. */}
        <Providers>{children}</Providers>
        <RouteScrollReset />
        <ServiceWorkerRegister />
        <InstallPrompt />
        <CookieConsent />
        <ChatWidget />
        <TrackingScripts />
        <ImageProtection />
      </body>
    </html>
  );
}
