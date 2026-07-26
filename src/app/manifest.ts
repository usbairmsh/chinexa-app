import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ChineXa — Premium Beauty & Lifestyle",
    short_name: "ChineXa",
    description:
      "Shop authentic Korean skincare, luxury bags, exquisite jewelry, fine perfumes & imported beauty products in Bangladesh.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    // Install splash + app tint. A static manifest can hold only one value
    // each (no media queries), so these use the light palette to match the
    // app's light-first default; the per-scheme switch lives on the viewport
    // themeColor in layout.tsx. Pearl background, plum-ink theme.
    background_color: "#FFF8FB",
    theme_color: "#3A2438",
    icons: [
      { src: "/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/favicon/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/favicon/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["shopping", "beauty", "lifestyle"],
  };
}
