import type { Metadata } from "next";
import { playfairDisplay, inter } from "@/lib/fonts";
import { Providers } from "@/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ChineXa — True Beauty Knows No Borders",
    template: "%s | ChineXa",
  },
  description:
    "Discover premium skincare, luxury bags, exquisite jewelry, fine perfumes, and imported beauty products. ChineXa brings world-class beauty to Bangladesh.",
  keywords: [
    "ChineXa",
    "premium beauty",
    "luxury skincare",
    "bags",
    "jewelry",
    "perfumes",
    "Bangladesh",
    "beauty products",
    "imported products",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "ChineXa",
    title: "ChineXa — Premium Beauty & Lifestyle",
    description:
      "Discover premium skincare, luxury bags, exquisite jewelry, fine perfumes, and imported beauty products.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChineXa — Premium Beauty & Lifestyle",
    description:
      "Discover premium skincare, luxury bags, exquisite jewelry, fine perfumes, and imported beauty products.",
  },
  robots: {
    index: true,
    follow: true,
  },
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
