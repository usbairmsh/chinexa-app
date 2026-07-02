import type { Metadata, Viewport } from "next";
import { playfairDisplay, inter } from "@/lib/fonts";
import { Providers } from "@/providers";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#C0392B",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ChineXa — Premium Beauty, Skincare & Lifestyle Store in Bangladesh",
    template: "%s | ChineXa",
  },
  description:
    "Shop authentic Korean skincare, luxury bags, exquisite jewelry, fine perfumes & imported beauty products in Bangladesh. Free delivery on orders over ৳3,000. Genuine products with cash on delivery.",
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
  alternates: {
    canonical: siteUrl,
  },
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
        url: `${siteUrl}/logo.png`,
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
    images: [`${siteUrl}/logo.png`],
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
  verification: {
    // Add your verification codes here after setting up Search Console
    // google: "your-google-verification-code",
    // yandex: "your-yandex-code",
  },
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
  manifest: "/favicon/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${playfairDisplay.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body text-charcoal bg-background">
        {/* Initial splash screen — covers everything until content is ready */}
        <div id="initial-loader" style={{
          position: "fixed", inset: 0, zIndex: 99999,
          display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px",
          background: "#fff",
        }}>
          <img src="/favicon/android-chrome-192x192.png" alt="" width="64" height="64" style={{ borderRadius: "16px" }} />
          <div style={{ width: 40, height: 40, border: "3px solid #f0e6e3", borderTop: "3px solid #C0392B", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <style dangerouslySetInnerHTML={{ __html: `@keyframes spin{to{transform:rotate(360deg)}} #initial-loader.fade-out{opacity:0;pointer-events:none;transition:opacity 0.4s ease}` }} />
        </div>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var loader=document.getElementById('initial-loader');
            if(!loader)return;
            function hide(){loader.classList.add('fade-out');setTimeout(function(){loader.style.display='none'},400)}
            var hidden=false;
            function tryHide(){if(hidden)return;var hero=document.querySelector('[class*="hero"],main img,[class*="swiper"]');if(hero||document.readyState==='complete'){hidden=true;setTimeout(hide,200)}}
            window.addEventListener('load',function(){setTimeout(tryHide,100)});
            var check=setInterval(tryHide,300);
            setTimeout(function(){clearInterval(check);tryHide();if(!hidden){hidden=true;hide()}},4000);
          })();
        `}} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
