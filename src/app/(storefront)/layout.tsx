import { Header } from "@/components/layout/header/header";
import { Footer } from "@/components/layout/footer/footer";
import { CartDrawer } from "@/components/storefront/cart/cart-drawer";
import { SearchOverlay } from "@/components/storefront/search/search-overlay";
import { ScrollToTop } from "@/components/shared/scroll-to-top";
import { OrganizationJsonLd, WebsiteJsonLd } from "@/components/seo/json-ld";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <OrganizationJsonLd />
      <WebsiteJsonLd />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      <SearchOverlay />
      <ScrollToTop />
    </>
  );
}
