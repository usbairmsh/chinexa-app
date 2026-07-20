"use client";

import dynamic from "next/dynamic";

// ssr:false requires a Client Component boundary in the App Router — this
// file exists solely to hold that directive; the storefront layout (a Server
// Component) can't call dynamic(..., { ssr: false }) directly.
export const CartDrawer = dynamic(() => import("@/components/storefront/cart/cart-drawer").then((m) => m.CartDrawer), { ssr: false });
