"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ShoppingBag, Heart, MapPin, UserCircle,
  LogOut, ChevronRight, HelpCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/header/header";
import { PageLoader } from "@/components/shared/page-loader";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { useCustomerBadge } from "@/hooks/use-customer-badge";
import { Footer } from "@/components/layout/footer/footer";
import { CartDrawer } from "@/components/storefront/cart/cart-drawer";
import { SearchOverlay } from "@/components/storefront/search/search-overlay";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth.store";
import { cn, getInitials } from "@/lib/utils";

// Notifications intentionally omitted — they live in the header bell popup now
const accountNav = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: ShoppingBag, label: "My Orders", href: "/dashboard/orders" },
  { icon: Heart, label: "Wishlist", href: "/dashboard/wishlist" },
  { icon: MapPin, label: "Addresses", href: "/dashboard/addresses" },
  { icon: UserCircle, label: "Profile", href: "/dashboard/profile" },
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

  // The auth store rehydrates from localStorage on the client, so its values
  // differ from the server-rendered HTML on hard refresh. Rendering them before
  // mount causes a hydration mismatch → React re-renders the whole tree → the
  // initial splash loader gets stuck. Gate on `mounted` so the first client
  // render matches the server exactly.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const user = mounted ? storeUser : null;
  const isAuthenticated = mounted ? storeAuthenticated : false;

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <>
      <Suspense><PageLoader /></Suspense>
      <Header />
      <main className="flex-1 bg-pearl/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
          {/* Page Header */}
          <div className="mb-6 lg:mb-8">
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

          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* ── Sidebar ── */}
            <aside className="w-full lg:w-[280px] shrink-0">
              <div className="bg-white rounded-2xl shadow-card border border-border/20">
                {/* User Card */}
                <div className="p-4 sm:p-5 bg-gradient-to-br from-primary-light to-pearl">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 ring-2 ring-white shadow-md">
                      <AvatarFallback className="text-xs sm:text-sm font-semibold bg-secondary text-white">
                        {user?.name ? getInitials(user.name) : "G"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-charcoal flex items-center gap-1 text-sm sm:text-base">
                        <span className="truncate">{user?.name || "Guest User"}</span>
                        {badge && <VerifiedBadge color={badge.badge_color} opacity={badge.badge_opacity} size={17} tooltip={badge.badge_name} />}
                      </p>
                      <p className="text-xs text-charcoal-lighter truncate">
                        {user?.phone || "Not signed in"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Nav Items — horizontal scroll on mobile, vertical on desktop */}
                <nav className="p-2 flex lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1 lg:gap-0 scrollbar-hide">
                  {accountNav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-2.5 rounded-xl text-sm transition-all duration-150 whitespace-nowrap shrink-0",
                        isActive(item.href)
                          ? "bg-secondary/10 text-secondary font-medium"
                          : "text-charcoal/70 hover:bg-pearl hover:text-charcoal"
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {isActive(item.href) && (
                        <ChevronRight className="h-3.5 w-3.5 text-secondary hidden lg:block" />
                      )}
                    </Link>
                  ))}

                  <Separator className="my-2 hidden lg:block" />

                  {/* Logout */}
                  {isAuthenticated ? (
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-2.5 rounded-xl text-sm text-charcoal/70 hover:bg-destructive/5 hover:text-destructive transition-all duration-150 w-full whitespace-nowrap shrink-0"
                    >
                      <LogOut className="h-[18px] w-[18px]" />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <Link
                      href="/login"
                      className="flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-2.5 rounded-xl text-sm text-secondary font-medium hover:bg-secondary/5 transition-all duration-150 whitespace-nowrap shrink-0"
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
      <SearchOverlay />
    </>
  );
}
