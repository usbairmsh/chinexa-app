export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { Header } from "@/components/layout/header/header";
import { Footer } from "@/components/layout/footer/footer";
import { CartDrawer } from "@/components/storefront/cart/cart-drawer-lazy";
import { BackInStockToast } from "@/components/storefront/wishlist/back-in-stock-toast";
import { ScrollToTop } from "@/components/shared/scroll-to-top";
import { PageLoader } from "@/components/shared/page-loader";
import { OrganizationJsonLd, WebsiteJsonLd, LocalBusinessJsonLd } from "@/components/seo/json-ld";
import { getSchemaConfig } from "@/lib/seo";
import pool from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import Image from "next/image";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check maintenance mode server-side
  let maintenanceMode = false;
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT value FROM settings WHERE `key` = 'maintenance_mode'"
    );
    if (rows.length > 0) {
      const val = typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
      maintenanceMode = !!val;
    }
  } catch {}

  if (maintenanceMode) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-6 max-w-lg animate-fade-in">
          <Image src="/logo.png" alt="ChineXa" width={400} height={152} className="h-[120px] w-auto mx-auto mb-8 animate-float" />
          <div className="relative mb-8">
            <div className="h-1 w-24 bg-secondary/20 rounded-full mx-auto" />
            <div className="h-1 w-12 bg-secondary rounded-full mx-auto mt-1" />
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-4 animate-fade-up">
            We&apos;ll Be Back Soon
          </h1>
          <p className="text-charcoal-lighter text-lg mb-6 animate-fade-up">
            We&apos;re performing scheduled maintenance to improve your shopping experience. Please check back shortly.
          </p>
          <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-pearl text-sm text-charcoal-lighter shadow-[var(--shadow-soft)] animate-fade-up">
            <svg className="h-4 w-4 animate-spin text-secondary" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Maintenance in progress
          </div>
        </div>
      </div>
    );
  }

  // Admin-controlled structured-data toggles (SEO Management → Schema).
  const schema = await getSchemaConfig();

  // Store contact details for LocalBusiness markup — best-effort read of the
  // same settings the admin already maintains; missing keys just omit fields.
  let storeInfo: { name?: string; phone?: string; address?: string } = {};
  if (schema.local_business) {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT `key`, value FROM settings WHERE `key` IN ('store_name','store_phone','store_address')"
      );
      const parse = (v: unknown) => { try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return v; } };
      for (const r of rows) {
        const val = parse(r.value);
        if (typeof val !== "string" || !val) continue;
        if (r.key === "store_name") storeInfo.name = val;
        if (r.key === "store_phone") storeInfo.phone = val;
        if (r.key === "store_address") storeInfo.address = val;
      }
    } catch { storeInfo = {}; }
  }

  return (
    <>
      {schema.organization && <OrganizationJsonLd />}
      {schema.website && <WebsiteJsonLd />}
      {schema.local_business && <LocalBusinessJsonLd name={storeInfo.name} phone={storeInfo.phone} address={storeInfo.address} />}
      <Suspense><PageLoader /></Suspense>
      <Header />
      <main className="flex-1 overflow-x-hidden">{children}</main>
      <Footer />
      <CartDrawer />
      <BackInStockToast />
      <ScrollToTop />
    </>
  );
}
