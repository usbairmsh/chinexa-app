"use client";

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ShoppingBag, Heart, MapPin, UserCircle,
  LogOut, ChevronRight, Settings, Bell, HelpCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/header/header";
import { PageLoader } from "@/components/shared/page-loader";
import { Footer } from "@/components/layout/footer/footer";
import { CartDrawer } from "@/components/storefront/cart/cart-drawer";
import { SearchOverlay } from "@/components/storefront/search/search-overlay";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth.store";
import { cn, getInitials } from "@/lib/utils";

const accountNav = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: ShoppingBag, label: "My Orders", href: "/dashboard/orders" },
  { icon: Heart, label: "Wishlist", href: "/dashboard/wishlist" },
  { icon: MapPin, label: "Addresses", href: "/dashboard/addresses" },
  { icon: UserCircle, label: "Profile", href: "/dashboard/profile" },
  { icon: Bell, label: "Notifications", href: "/dashboard/notifications" },
  { icon: HelpCircle, label: "Help & Support", href: "/faq" },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

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
            <aside className="w-full lg:w-[260px] shrink-0">
              <div className="bg-white rounded-2xl shadow-card border border-border/20 overflow-hidden">
                {/* User Card */}
                <div className="p-5 bg-gradient-to-br from-primary-light to-pearl">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 ring-2 ring-white shadow-md">
                      <AvatarFallback className="text-sm font-semibold bg-secondary text-white">
                        {user?.name ? getInitials(user.name) : "G"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-charcoal truncate">
                        {user?.name || "Guest User"}
                      </p>
                      <p className="text-xs text-charcoal-lighter truncate">
                        {user?.phone || "Not signed in"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Nav Items */}
                <nav className="p-2">
                  {accountNav.map((item) => (
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
                  ))}

                  <Separator className="my-2" />

                  {/* Logout */}
                  {isAuthenticated ? (
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-charcoal/70 hover:bg-destructive/5 hover:text-destructive transition-all duration-150 w-full"
                    >
                      <LogOut className="h-[18px] w-[18px]" />
                      <span>Sign Out</span>
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
      <SearchOverlay />
    </>
  );
}
