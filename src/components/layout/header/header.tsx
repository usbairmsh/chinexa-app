"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Search, Heart, ShoppingBag, User, Menu, X, ChevronDown, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { useUIStore } from "@/stores/ui.store";
import { useAuthStore } from "@/stores/auth.store";
import { useCategoriesStore } from "@/stores/categories.store";
import { MAIN_NAV, type NavItem } from "@/data/constants/navigation";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "./notification-bell";
import { useCustomerBadge } from "@/hooks/use-customer-badge";

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const cartCount = useCartStore((s) => s.getItemCount());
  const wishlistCount = useWishlistStore((s) => s.items.length);
  const { mobileMenuOpen, setMobileMenuOpen, setSearchOverlayOpen, setCartDrawerOpen } = useUIStore();
  const storeAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Persisted store differs from server HTML on hard refresh — rendering it
  // before mount causes a hydration mismatch that wedges the splash loader.
  const isAuthenticated = mounted && storeAuthenticated;
  const badgeData = useCustomerBadge();
  const hiddenSeedIds = useCategoriesStore((s) => s.hiddenSeedIds);
  const [navItems, setNavItems] = useState<NavItem[]>(MAIN_NAV);
  // Start hidden — showing the bar with placeholder text before /api/settings
  // resolves would flash fake copy in front of every visitor on every page load.
  const [announcement, setAnnouncement] = useState<{ visible: boolean; text: string; phone: string }>({ visible: false, text: "", phone: "" });

  useEffect(() => {
    setMounted(true);
    // Fetch announcement bar + store phone from settings
    fetch("/api/settings?keys=announcement,store_phone,homepage_config")
      .then((r) => r.json())
      .then((data) => {
        // Prefer the direct announcement key from settings page
        if (data?.announcement) {
          setAnnouncement({ visible: data.announcement.visible !== false, text: data.announcement.text || "", phone: data.store_phone || announcement.phone });
        } else if (data?.homepage_config?.announcement) {
          setAnnouncement({ ...data.homepage_config.announcement, phone: data.store_phone || announcement.phone });
        }
        if (data?.store_phone) setAnnouncement((prev) => ({ ...prev, phone: data.store_phone }));
      })
      .catch(() => {});
    // Fetch categories from database — this is the single source of truth
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setNavItems(data
            .filter((c: Record<string, unknown>) => !hiddenSeedIds.includes(c.id as string))
            .map((c: Record<string, unknown>) => {
              // Build children from DB subcategories
              const dbChildren = Array.isArray(c.children) && (c.children as Record<string, unknown>[]).length > 0
                ? (c.children as Record<string, unknown>[]).map((sub) => ({
                    label: sub.name as string,
                    href: `/categories/${sub.slug}`,
                  }))
                : undefined;
              return {
                label: c.name as string,
                href: `/categories/${c.slug}`,
                children: dbChildren,
              };
            }));
        }
      })
      .catch(() => {
        // Fallback to MAIN_NAV only if DB fetch fails completely
        setNavItems(MAIN_NAV);
      });
  }, [hiddenSeedIds]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* ══════ STICKY UNIT: announcement bar + main header pinned together ══════ */}
      {/* Both live inside one sticky container so the header never "jumps" up when the
          announcement bar scrolls out of the normal document flow — the whole assembly
          moves as a single pinned block instead of the header snapping to top:0 mid-scroll. */}
      <div className="sticky top-0 z-40 w-full">
        {/* ══════ TOP UTILITY BAR ══════ */}
        {announcement.visible && (
          <div className="bg-primary-light border-b border-border/20">
            <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 flex items-center justify-between h-8">
              <span className="text-[11px] text-charcoal-lighter hidden sm:flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> {announcement.phone || "+880 1700-000000"}
              </span>
              <p className="text-[10px] sm:text-[11px] text-charcoal-light text-center flex-1 sm:flex-none tracking-wide truncate px-2 sm:px-0">
                {announcement.text || "Free shipping above ৳3,000 | Use code WELCOME10 for 10% off"}
              </p>
              <div className="hidden sm:flex items-center gap-4 text-[11px] text-charcoal-lighter">
                <Link href="/track-order" className="hover:text-secondary transition-colors">Track Order</Link>
                <Link href="/faq" className="hover:text-secondary transition-colors">FAQ</Link>
              </div>
            </div>
          </div>
        )}

        {/* ══════ MAIN HEADER ══════ */}
        <header
          className={cn(
            "w-full transition-all duration-300",
            scrolled
              ? "bg-white/97 backdrop-blur-xl shadow-[0_1px_20px_rgba(0,0,0,0.06)] border-b border-border/20"
              : "bg-white border-b border-border/10"
          )}
        >
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="flex items-center h-[52px] sm:h-[60px] lg:h-[68px]">

            {/* ── LEFT: Hamburger (mobile) + Logo ── */}
            <div className="flex items-center gap-2 lg:gap-0 shrink-0">
              <motion.button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="lg:hidden flex items-center justify-center h-9 w-9 rounded-full hover:bg-primary-light text-charcoal transition-colors"
                aria-label="Toggle menu"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={mobileMenuOpen ? "close" : "open"}
                    initial={{ opacity: 0, rotate: -45 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 45 }}
                    transition={{ duration: 0.15 }}
                    className="flex"
                  >
                    {mobileMenuOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>

              <Link href="/" className="flex items-center overflow-hidden">
                <Image
                  src="/logo.png"
                  alt="ChineXa"
                  width={216}
                  height={84}
                  className="h-[46px] sm:h-[58px] lg:h-[67px] w-auto object-contain scale-[1.1] sm:scale-[1.2]"
                  priority
                />
              </Link>

              {/* Search — lives beside the logo (bell took its old spot on the right) */}
              <motion.button
                onClick={() => setSearchOverlayOpen(true)}
                whileHover={{ scale: 1.12, rotate: -8 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="flex items-center justify-center h-9 w-9 rounded-full text-charcoal/60 hover:text-charcoal hover:bg-primary-light transition-colors ml-1 lg:ml-3"
                aria-label="Search"
              >
                <Search className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              </motion.button>
            </div>

            {/* ── CENTER: Navigation ── */}
            <nav
              className="hidden lg:flex items-center gap-0.5 mx-auto"
              onMouseLeave={() => setActiveMenu(null)}
            >
              {navItems.map((item) => (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setActiveMenu(item.children ? item.label : null)}
                >
                  <Link
                    href={item.href}
                    className={cn(
                      "relative inline-flex items-center gap-1 px-4 py-2 text-[13px] font-medium tracking-wide uppercase transition-colors",
                      activeMenu === item.label
                        ? "text-secondary"
                        : "text-charcoal/70 hover:text-charcoal"
                    )}
                  >
                    {item.label}
                    {item.children && (
                      <ChevronDown className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        activeMenu === item.label && "rotate-180"
                      )} />
                    )}
                    {item.badge && (
                      <span className="text-[8px] font-bold bg-secondary text-white px-1.5 py-[1px] rounded-full leading-tight uppercase">
                        {item.badge}
                      </span>
                    )}
                    {/* Active underline */}
                    {activeMenu === item.label && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute bottom-0 left-4 right-4 h-[2px] bg-secondary rounded-full"
                      />
                    )}
                  </Link>

                  {/* Dropdown */}
                  <AnimatePresence>
                    {item.children && activeMenu === item.label && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="absolute left-0 top-full pt-3 z-50"
                      >
                        <div className="w-60 rounded-2xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.1)] border border-border/20 p-2 backdrop-blur-xl">
                          {item.children.map((child) => (
                            <Link
                              key={child.label}
                              href={child.href}
                              className={cn(
                                "flex items-center rounded-xl px-3.5 py-2.5 text-[13px] transition-all duration-150",
                                child.featured
                                  ? "font-semibold text-secondary hover:bg-secondary/5"
                                  : "text-charcoal/70 hover:text-charcoal hover:bg-pearl"
                              )}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </nav>

            {/* ── RIGHT: Action Icons (visible on all screens) ── */}
            <div className="flex items-center gap-1 shrink-0 ml-auto lg:ml-0">
              {/* Notifications — signed-in customers only */}
              {isAuthenticated && <NotificationBell />}

              {/* Wishlist */}
              <Link href="/wishlist" aria-label="Wishlist">
                <motion.span
                  whileHover={{ scale: 1.12, rotate: 8 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="relative flex items-center justify-center h-9 w-9 rounded-full text-charcoal/60 hover:text-charcoal hover:bg-primary-light transition-colors"
                >
                  <Heart className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                  <AnimatePresence>
                    {mounted && wishlistCount > 0 && (
                      <motion.span
                        key={wishlistCount}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 12 }}
                        className="absolute top-0 right-0 sm:top-0.5 sm:right-0.5 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-secondary text-[8px] font-bold text-white ring-2 ring-white"
                      >
                        {wishlistCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.span>
              </Link>

              {/* Cart — hidden on cart page */}
              {pathname !== "/cart" && (
                <motion.button
                  onClick={() => setCartDrawerOpen(true)}
                  whileHover={{ scale: 1.12, rotate: -8 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="relative flex items-center justify-center h-9 w-9 rounded-full text-charcoal/60 hover:text-charcoal hover:bg-primary-light transition-colors"
                  aria-label="Cart"
                >
                  <ShoppingBag className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                  <AnimatePresence>
                    {mounted && cartCount > 0 && (
                      <motion.span
                        key={cartCount}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 12 }}
                        className="absolute top-0 right-0 sm:top-0.5 sm:right-0.5 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-secondary text-[8px] font-bold text-white ring-2 ring-white"
                      >
                        {cartCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              )}

              {/* Account — profile icon + tier name in one rounded-border pill, tinted in the tier's own color.
                  Styled with a subtle gradient sheen + tier-tinted shadow + ring so it reads as a premium
                  membership chip rather than a flat outline. */}
              {isAuthenticated ? (
                badgeData?.tier_name ? (
                  <Link
                    href="/dashboard"
                    className={cn(
                      "group relative flex items-center gap-1.5 h-9 pl-1 pr-3.5 rounded-full border bg-gradient-to-b from-white/80 to-white/30 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-px",
                      badgeData.tier_color || "border-border text-charcoal/60 hover:bg-primary-light"
                    )}
                    style={{ borderColor: "currentColor", boxShadow: "0 1px 6px -1px currentColor" }}
                    aria-label="Account"
                    title={`${badgeData.tier_name} Member`}
                  >
                    <motion.span
                      whileHover={{ scale: 1.15, rotate: 8 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className="flex items-center justify-center h-7 w-7 rounded-full bg-white"
                      style={{ boxShadow: "inset 0 0 0 1px currentColor" }}
                    >
                      <User className="h-3.5 w-3.5" />
                    </motion.span>
                    <span className="text-[11px] font-bold tracking-wide whitespace-nowrap uppercase">{badgeData.tier_name}</span>
                  </Link>
                ) : (
                  <Link href="/dashboard" aria-label="Account">
                    <motion.span
                      whileHover={{ scale: 1.12, rotate: 8 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className="flex items-center justify-center h-9 w-9 rounded-full text-charcoal/60 hover:text-charcoal hover:bg-primary-light transition-colors"
                    >
                      <User className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                    </motion.span>
                  </Link>
                )
              ) : (
                <>
                  {/* Mobile — icon */}
                  <Link href="/login" aria-label="Sign In" className="flex sm:hidden">
                    <motion.span
                      whileHover={{ scale: 1.12, rotate: 8 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className="flex items-center justify-center h-9 w-9 rounded-full bg-secondary text-white hover:bg-secondary-dark transition-colors"
                    >
                      <User className="h-4 w-4" />
                    </motion.span>
                  </Link>
                  {/* Desktop — pill button */}
                  <div className="hidden sm:flex items-center">
                    <div className="w-px h-5 bg-border/30 mx-2" />
                    <Link href="/login">
                      <motion.span
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                        className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-secondary text-white text-[13px] font-body font-medium tracking-wide hover:bg-secondary-dark hover:shadow-lg transition-colors duration-200 cursor-pointer"
                      >
                        <User className="h-3.5 w-3.5" />
                        Sign In
                      </motion.span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        </header>
      </div>

      {/* ══════ MOBILE MENU ══════ */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-charcoal/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[300px] bg-white shadow-[20px_0_60px_rgba(0,0,0,0.1)] lg:hidden flex flex-col"
            >
              <div className="flex-1 overflow-y-auto overscroll-contain p-5">
                {/* Mobile Header */}
                <div className="flex items-center justify-between mb-2 pb-4 border-b border-border/20">
                  <Image src="/logo.png" alt="ChineXa" width={120} height={46} className="h-10 w-auto" />
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-pearl text-charcoal-lighter"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Tier badge — same premium pill as the header, sized up for mobile */}
                {isAuthenticated && badgeData?.tier_name && (
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 w-fit h-9 pl-1 pr-3.5 rounded-full border bg-gradient-to-b from-white/80 to-white/30 shadow-sm mb-4",
                      badgeData.tier_color || "border-border text-charcoal/60"
                    )}
                    style={{ borderColor: "currentColor", boxShadow: "0 1px 6px -1px currentColor" }}
                  >
                    <span
                      className="flex items-center justify-center h-7 w-7 rounded-full bg-white"
                      style={{ boxShadow: "inset 0 0 0 1px currentColor" }}
                    >
                      <User className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-bold tracking-wide uppercase">{badgeData.tier_name} Member</span>
                  </Link>
                )}

                {/* Mobile Nav */}
                <nav className="space-y-0.5">
                  {navItems.map((item) => (
                    <div key={item.label}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between py-2.5 px-2 rounded-xl text-[15px] font-medium text-charcoal hover:bg-primary-light hover:text-secondary transition-colors"
                      >
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className="text-[8px] font-bold bg-secondary text-white px-1.5 py-[1px] rounded-full uppercase">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                      {item.children && (
                        <div className="ml-3 pl-3 border-l-2 border-primary-light space-y-0.5 mb-1">
                          {item.children.filter(c => !c.featured).map((child) => (
                            <Link
                              key={child.label}
                              href={child.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className="block py-2 px-2 rounded-lg text-sm text-charcoal-lighter hover:text-secondary hover:bg-pearl/50 transition-colors"
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </nav>

                {/* Mobile Footer Actions */}
                <div className="mt-6 pt-5 border-t border-border/20 space-y-2">
                  <Link
                    href="/wishlist"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 py-2.5 px-2 rounded-xl text-sm text-charcoal-light hover:bg-primary-light transition-colors"
                  >
                    <Heart className="h-4 w-4" /> Wishlist
                    {mounted && wishlistCount > 0 && (
                      <span className="ml-auto text-[10px] bg-secondary text-white px-1.5 py-0.5 rounded-full font-bold">{wishlistCount}</span>
                    )}
                  </Link>
                  <Link
                    href="/track-order"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 py-2.5 px-2 rounded-xl text-sm text-charcoal-light hover:bg-primary-light transition-colors"
                  >
                    <ShoppingBag className="h-4 w-4" /> Track Order
                  </Link>
                  {!isAuthenticated && (
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block mt-2">
                      <Button variant="secondary" className="w-full rounded-xl">Sign In</Button>
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
