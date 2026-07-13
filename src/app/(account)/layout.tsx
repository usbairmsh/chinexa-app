"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ShoppingBag, Heart, MapPin, UserCircle,
  LogOut, ChevronRight, HelpCircle, Tag, Crown, MessageCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/header/header";
import { PageLoader } from "@/components/shared/page-loader";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { useCustomerBadge } from "@/hooks/use-customer-badge";
import { Footer } from "@/components/layout/footer/footer";
import { CartDrawer } from "@/components/storefront/cart/cart-drawer";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth.store";
import { useChatStore } from "@/stores/chat.store";
import { cn, getInitials } from "@/lib/utils";
import { resolveTierColorStyle } from "@/lib/tier-color";

// Same 4-square layout as lucide's LayoutDashboard, but with a much smaller
// corner radius (rx 0.5 vs lucide's rx 1) so the tiles read as near-square
// rather than pill-like at the small sizes this nav renders icons at.
function SquareDashboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="7" height="9" x="3" y="3" rx="0.5" />
      <rect width="7" height="5" x="14" y="3" rx="0.5" />
      <rect width="7" height="9" x="14" y="12" rx="0.5" />
      <rect width="7" height="5" x="3" y="16" rx="0.5" />
    </svg>
  );
}

// Notifications intentionally omitted — they live in the header bell popup now
const accountNav = [
  { icon: SquareDashboardIcon, label: "Dashboard", href: "/dashboard" },
  { icon: ShoppingBag, label: "My Orders", href: "/dashboard/orders" },
  { icon: Heart, label: "Wishlist", href: "/dashboard/wishlist" },
  { icon: MapPin, label: "Addresses", href: "/dashboard/addresses" },
  { icon: Tag, label: "Offers & Coupons", href: "/dashboard/coupons" },
  { icon: Crown, label: "Membership Benefits", href: "/dashboard/membership" },
  { icon: UserCircle, label: "Profile", href: "/dashboard/profile" },
  { icon: MessageCircle, label: "Get Help", href: "#chat" },
  { icon: HelpCircle, label: "Help & Support", href: "/faq" },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user: storeUser, isAuthenticated: storeAuthenticated, logout } = useAuthStore();
  const badge = useCustomerBadge();
  const openChat = useChatStore((s) => s.openChat);

  // The auth store rehydrates from localStorage on the client, so its values
  // differ from the server-rendered HTML on hard refresh. Rendering them before
  // mount causes a hydration mismatch → React re-renders the whole tree → the
  // initial splash loader gets stuck. Gate on `mounted` so the first client
  // render matches the server exactly.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const user = mounted ? storeUser : null;
  const isAuthenticated = mounted ? storeAuthenticated : false;

  // The whole account section is members-only — once the persisted store has
  // rehydrated, bounce anyone who isn't actually signed in to /login.
  useEffect(() => {
    if (mounted && !storeAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [mounted, storeAuthenticated, pathname, router]);

  const tierColor = resolveTierColorStyle(badge?.tier_color);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  // Avoid flashing real account content before the redirect-to-login effect
  // above fires (mounted-but-not-yet-redirected is a brief real state, not a
  // hydration mismatch, since both server and client render nothing here).
  if (mounted && !storeAuthenticated) {
    return (
      <>
        <Suspense><PageLoader /></Suspense>
        <Header />
        <CartDrawer />
      </>
    );
  }

  return (
    <>
      <Suspense><PageLoader /></Suspense>
      <Header />
      <main className="flex-1 bg-pearl/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 lg:py-10">
          {/* Page Header — desktop only. On phone/tablet this is redundant with
              the compact profile strip below, which already carries the name. */}
          <div className="hidden lg:block mb-6 lg:mb-8">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-heading text-2xl sm:text-3xl font-semibold text-charcoal"
            >
              My Account
            </motion.h1>
            <p className="text-sm text-charcoal-lighter mt-1">
              Welcome back{user?.name ? `, ${user.name}` : ""}
            </p>
          </div>

          {/* ── Phone/tablet — compact profile strip + horizontally scrollable
              quick-nav, replacing the full sidebar so real page content starts
              almost immediately instead of after a screen of chrome. ── */}
          <div className="lg:hidden -mx-4 sm:-mx-6 mb-4">
            {/* Same tier-tinted card used in the desktop sidebar — big centered
                avatar, name + tier pill inline, phone below, View Profile button. */}
            <div
              className={cn("mx-4 sm:mx-6 rounded-2xl p-5 flex flex-col items-center text-center shadow-card", tierColor.className)}
              style={tierColor.style}
            >
              <Avatar className="h-16 w-16 ring-2 ring-white/70 shadow-md">
                {user?.avatar && <AvatarImage src={user.avatar} alt={user.name || "Profile"} />}
                <AvatarFallback className="text-lg font-semibold bg-secondary text-white">
                  {user?.name ? getInitials(user.name) : "G"}
                </AvatarFallback>
              </Avatar>

              <div className="mt-3 flex items-center gap-1.5 min-w-0 max-w-full">
                <span className="font-heading font-semibold text-base text-charcoal truncate">{user?.name || "Guest User"}</span>
                {badge?.badge_color && <VerifiedBadge color={badge.badge_color} opacity={badge.badge_opacity} size={17} tooltip={badge.badge_name} />}
                {badge?.tier_name && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/70 text-charcoal">
                    {badge.tier_name}
                  </span>
                )}
              </div>

              <p className="mt-0.5 text-xs text-charcoal/70 truncate max-w-full">
                {user?.phone || "Not signed in"}
              </p>

              <Link
                href="/dashboard/profile"
                className="mt-4 w-full py-2 rounded-xl bg-white/90 text-charcoal text-sm font-medium hover:bg-white transition-colors"
              >
                View Profile
              </Link>
            </div>

            <nav className="mt-3 flex items-center gap-2 overflow-x-auto px-4 sm:px-6 pb-1 scrollbar-none">
              {accountNav.map((item) =>
                item.href === "#chat" ? (
                  <button
                    key={item.href}
                    onClick={() => openChat("help_and_support")}
                    className="flex flex-col items-center gap-1 shrink-0 w-16 py-2 rounded-xl text-charcoal/70 hover:bg-pearl hover:text-charcoal transition-colors"
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium leading-none text-center">{item.label}</span>
                  </button>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center gap-1 shrink-0 w-16 py-2 rounded-xl transition-colors",
                      isActive(item.href)
                        ? "bg-secondary/10 text-secondary"
                        : "text-charcoal/70 hover:bg-pearl hover:text-charcoal"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium leading-none text-center">{item.label}</span>
                  </Link>
                )
              )}
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="flex flex-col items-center gap-1 shrink-0 w-16 py-2 rounded-xl text-charcoal/70 hover:bg-destructive/5 hover:text-destructive transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="text-[10px] font-medium leading-none">Sign Out</span>
                </button>
              ) : (
                <Link
                  href="/login"
                  className="flex flex-col items-center gap-1 shrink-0 w-16 py-2 rounded-xl text-secondary transition-colors"
                >
                  <LogOut className="h-5 w-5 rotate-180" />
                  <span className="text-[10px] font-medium leading-none">Sign In</span>
                </Link>
              )}
            </nav>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* ── Sidebar — desktop only ── */}
            <aside className="hidden lg:block w-full lg:w-[280px] shrink-0">
              <div className="bg-white rounded-2xl shadow-card border border-border/20">
                {/* User Card — dark rounded card, avatar on top, name + tier badge
                    beside it, phone below, View Profile button at the bottom.
                    Background is the customer's own tier color (same fill the
                    header's account pill uses), so the card itself reads as
                    the member's tier rather than a neutral panel. */}
                <div
                  className={cn("rounded-2xl m-2 p-5 flex flex-col items-center text-center", tierColor.className)}
                  style={tierColor.style}
                >
                  <Avatar className="h-16 w-16 sm:h-[72px] sm:w-[72px] ring-2 ring-white/70 shadow-md">
                    {user?.avatar && <AvatarImage src={user.avatar} alt={user.name || "Profile"} />}
                    <AvatarFallback className="text-lg font-semibold bg-secondary text-white">
                      {user?.name ? getInitials(user.name) : "G"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="mt-3 flex items-center gap-1.5 min-w-0 max-w-full">
                    <span className="font-heading font-semibold text-base truncate">{user?.name || "Guest User"}</span>
                    {badge?.badge_color && <VerifiedBadge color={badge.badge_color} opacity={badge.badge_opacity} size={17} tooltip={badge.badge_name} />}
                    {badge?.tier_name && (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/70">
                        {badge.tier_name}
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 text-xs opacity-80 truncate max-w-full">
                    {user?.phone || "Not signed in"}
                  </p>

                  <Link
                    href="/dashboard/profile"
                    className="mt-4 w-full py-2 rounded-xl bg-white/90 text-charcoal text-sm font-medium hover:bg-white transition-colors"
                  >
                    View Profile
                  </Link>
                </div>

                <nav className="flex flex-col p-2">
                  {accountNav.map((item) =>
                    item.href === "#chat" ? (
                      <button
                        key={item.href}
                        onClick={() => openChat("help_and_support")}
                        className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-normal font-body text-charcoal/70 transition-all duration-150 hover:bg-pearl hover:text-charcoal"
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="flex-1 text-left font-normal">{item.label}</span>
                      </button>
                    ) : (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
                          isActive(item.href)
                            ? "bg-secondary/10 text-secondary font-medium"
                            : "text-charcoal/70 hover:bg-pearl hover:text-charcoal"
                        )}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {isActive(item.href) && (
                          <ChevronRight className="h-3.5 w-3.5 text-secondary" />
                        )}
                      </Link>
                    )
                  )}

                  <Separator className="my-2" />

                  {isAuthenticated ? (
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-normal font-body text-charcoal/70 transition-all duration-150 hover:bg-destructive/5 hover:text-destructive"
                    >
                      <LogOut className="h-[18px] w-[18px]" />
                      <span className="font-normal">Sign Out</span>
                    </button>
                  ) : (
                    <Link
                      href="/login"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-secondary font-medium hover:bg-secondary/5 transition-all duration-150"
                    >
                      <LogOut className="h-[18px] w-[18px] rotate-180" />
                      <span>Sign In</span>
                    </Link>
                  )}
                </nav>
              </div>
            </aside>

            {/* ── Main Content ── */}
            <div className="flex-1 min-w-0">
              {children}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
