"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Package, FolderTree, ShoppingCart, Users, Star,
  Image as ImageIcon, Tag, Gift, FileText, Search, BarChart3,
  DollarSign, AlertTriangle, Activity, UserCog, Settings,
  Menu, ChevronLeft, LogOut, Bell, Warehouse, Key, User, Loader2, Lock, MessageCircle, Megaphone, ShieldMinus
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { AdminNotificationBell } from "@/components/admin/notification-bell";
import { PageLoader } from "@/components/shared/page-loader";
import { Badge } from "@/components/ui/badge";
import { AdminContext } from "@/contexts/admin-context";
import { PERMISSION_SECTIONS, normalizePermissions, canDo, type PermissionsMap, type PermissionAction } from "@/lib/admin-permissions";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : "";
}

// Permission keys for each sidebar item
const navSections = [
  {
    label: "Main",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/admin", perm: "dashboard" },
      { icon: Package, label: "Products", href: "/admin/products", perm: "products" },
      { icon: Warehouse, label: "Stock Management", href: "/admin/stock", perm: "stock" },
      { icon: FolderTree, label: "Categories", href: "/admin/categories", perm: "categories" },
      { icon: ShoppingCart, label: "Order Management", href: "/admin/orders", perm: "orders" },
      { icon: Users, label: "Customers", href: "/admin/customers", perm: "customers" },
      { icon: Star, label: "Membership", href: "/admin/membership", perm: "customers" },
      { icon: ShieldMinus, label: "Points Deduction Rules", href: "/admin/points-deduction-rules", perm: "points_deduction_rules" },
    ],
  },
  {
    label: "Content",
    items: [
      { icon: ImageIcon, label: "Banners", href: "/admin/banners", perm: "banners" },
      { icon: Tag, label: "Coupons", href: "/admin/coupons", perm: "coupons" },
      { icon: Gift, label: "Offers", href: "/admin/offers", perm: "offers" },
      { icon: Bell, label: "Notifications", href: "/admin/notifications", perm: "customers" },
      { icon: Star, label: "Reviews", href: "/admin/reviews", perm: "reviews" },
      { icon: FileText, label: "Blog", href: "/admin/blog", perm: "blog" },
      { icon: LayoutDashboard, label: "Homepage", href: "/admin/homepage-builder", perm: "homepage" },
      { icon: Megaphone, label: "Announcements", href: "/admin/announcements", perm: "announcements" },
      { icon: FileText, label: "Policy Pages", href: "/admin/policies", perm: "policies" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { icon: Search, label: "SEO", href: "/admin/seo", perm: "seo" },
      { icon: BarChart3, label: "Analytics", href: "/admin/analytics", perm: "analytics" },
      { icon: DollarSign, label: "Accounting", href: "/admin/accounting", perm: "accounting" },
      { icon: AlertTriangle, label: "Fraud", href: "/admin/fraud", perm: "fraud" },
      { icon: Activity, label: "Activity Log", href: "/admin/activity-log", perm: "activity_log" },
    ],
  },
  {
    label: "Support",
    items: [
      { icon: MessageCircle, label: "Support Inbox", href: "/admin/support-inbox", perm: "support_inbox" },
    ],
  },
  {
    label: "System",
    items: [
      { icon: UserCog, label: "Users, Roles & Access", href: "/admin/users", perm: "users" },
      { icon: Settings, label: "Settings", href: "/admin/settings", perm: "settings" },
    ],
  },
];

// All available permission sections (for the access management UI) — each
// section declares which of view/add/edit/delete are actually meaningful for
// it, so the grid never shows a checkbox that would do nothing.
export const ALL_PERMISSIONS = PERMISSION_SECTIONS;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // <main> is its own scroll container (overflow-y-auto), so navigating
  // between admin pages doesn't reset window scroll — it leaves this pane
  // wherever it was on the previous page, landing the admin mid/end-of-page.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  // Admin profile state
  const [adminId, setAdminId] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  // The pathname the last completed whoami check was performed FOR (null =
  // no check has resolved yet). Pathname-keyed on purpose: a plain "checked"
  // boolean caused the double-login bug — after login's router.push, both
  // effects below ran in the same React commit closing over the login page's
  // stale "checked, unauthenticated" result, and the redirect guard bounced
  // the user straight back to /admin/login before the fresh check (which now
  // had the session cookie) could resolve. Keying the result by pathname
  // makes stale answers structurally inert: a 401 measured on /admin/login
  // can never justify redirecting away from /admin.
  const [authCheckedFor, setAuthCheckedFor] = useState<string | null>(null);

  // Profile dialog
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Permissions — action-map per section; superadmin ignores this entirely
  // (canDo() short-circuits true for role==='superadmin').
  const [adminPermissionsMap, setAdminPermissionsMap] = useState<PermissionsMap>({});

  // Password fields (inside profile modal)
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    // This layout wraps /admin/login too (it just hides its own chrome there
    // — see the `pathname === "/admin/login"` early return below — rather
    // than unmounting), so it was already mounted BEFORE login with no
    // session yet. Login sets the session cookie server-side and does a
    // client-side router.push, which never remounts this component, so a
    // one-shot `useEffect(..., [])` ran once too early, found no session, and
    // never tried again — the admin name/role in the header stayed blank
    // until a full page reload recreated everything from scratch. Depending
    // on `pathname` re-runs this right after the login→/admin transition
    // lands, and `adminName` in the guard skips redundant refetches on
    // ordinary in-app navigation once the profile is already loaded.
    //
    // The session cookie is httpOnly now (see admin-session.ts), so the
    // client can no longer read it itself to check "is there a session" or
    // "which admin is this" — the server is asked directly via "whoami"
    // instead, and its answer (or 401) is authoritative.
    if (adminName) return;
    fetch("/api/admin-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "whoami" }) })
      .then(async (r) => {
        if (!r.ok) { setAuthCheckedFor(pathname); return; }
        const me = await r.json();
        setAdminId(me.id as string);
        setAdminName(me.name as string);
        setAdminRole(me.role as string);
        setAdminEmail((me.email as string) || "");
        setAdminPhone((me.phone as string) || "");
        setAdminUsername((me.username as string) || "");
        // Superadmin has full access regardless of this map (canDo()
        // short-circuits on role); regular admins get the normalized
        // per-section action grants (handles both the legacy flat-array
        // shape and the current action-map shape transparently).
        setAdminPermissionsMap(normalizePermissions(me.permissions));
        setAuthCheckedFor(pathname);
      }).catch(() => setAuthCheckedFor(pathname));
  }, [pathname, adminName]);

  // proxy.ts already blocks unauthenticated requests at the edge, but it only
  // runs on the initial navigation — client-side transitions between admin
  // pages (Link clicks) don't re-hit it. If whoami comes back unauthenticated
  // (e.g. the session expired mid-visit), bounce to login here too, same as
  // the (account) customer layout already does for its own auth guard. The
  // authCheckedFor === pathname condition is load-bearing: only a check that
  // was performed for THIS pathname may trigger the redirect (see the state
  // declaration comment for the double-login bug a plain boolean caused).
  useEffect(() => {
    if (authCheckedFor === pathname && !adminName && pathname !== "/admin/login") {
      router.push(`/admin/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [authCheckedFor, adminName, pathname, router]);

  const handleSaveProfile = async () => {
    setProfileSaving(true); setProfileError("");
    const uname = profileUsername.trim().toLowerCase();
    if (!uname) { setProfileError("Username cannot be empty"); setProfileSaving(false); return; }
    try {
      const res = await fetch("/api/admin-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_profile", name: profileName.trim(), email: profileEmail.trim(), phone: profilePhone.trim(), username: uname }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setProfileError(data.error || "Could not save profile");
        return;
      }
      setAdminName(profileName.trim());
      setAdminEmail(profileEmail.trim());
      setAdminPhone(profilePhone.trim());
      setAdminUsername(uname);
      setProfileSuccess(true);
      setTimeout(() => { setProfileSuccess(false); setProfileOpen(false); }, 1500);
    } catch { setProfileError("Network error — profile not saved"); } finally { setProfileSaving(false); }
  };

  const handleChangePassword = async () => {
    setPwError("");
    if (!currentPw || !newPw) { setPwError("All fields are required"); return; }
    if (newPw.length < 6) { setPwError("Password must be at least 6 characters"); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match"); return; }
    setPwSaving(true);
    try {
      const res = await fetch("/api/admin-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "change_password", current_password: currentPw, new_password: newPw }) });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error); return; }
      setPwSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => { setPwSuccess(false); }, 1500);
    } catch {} finally { setPwSaving(false); }
  };

  const handleLogout = async () => {
    // chinexa-admin-id is httpOnly now (see admin-session.ts) — client-side
    // document.cookie writes can no longer see or clear it, so logout has to
    // go through the server, which clears all three cookies on the response.
    try {
      await fetch("/api/admin-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    } catch {}
    window.location.href = "/admin/login";
  };

  const openProfile = () => {
    setProfileName(adminName);
    setProfileEmail(adminEmail);
    setProfilePhone(adminPhone);
    setProfileUsername(adminUsername);
    setProfileError("");
    setProfileOpen(true);
  };

  const adminContextValue = {
    adminId,
    role: adminRole,
    permissions: adminPermissionsMap,
    name: adminName,
    email: adminEmail,
    phone: adminPhone,
    username: adminUsername,
    can: (section: string, action: PermissionAction) => canDo(adminRole, adminPermissionsMap, section, action),
  };

  // Admin login page renders without sidebar
  if (pathname === "/admin/login") {
    return <AdminContext.Provider value={adminContextValue}>{children}</AdminContext.Provider>;
  }

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  // Plain JSX, not a nested component function — a nested function gets a new
  // identity every render, so React tore down and remounted the whole sidebar
  // (including this <nav>'s scroll position) on every navigation, since
  // `pathname` changing re-renders AdminLayout on every route change.
  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-[76px] items-center justify-between px-4 border-b border-border/30">
        {!collapsed && (
          <Link href="/admin" className="flex items-center gap-1.5">
            <Image src="/logo.png" alt="ChineXa" width={200} height={76} className="h-[64px] w-auto" />
            <span className="text-[9px] text-charcoal-lighter font-body bg-pearl px-1.5 py-0.5 rounded-md">Admin</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex p-1.5 rounded-lg text-charcoal-lighter hover:text-charcoal hover:bg-primary-light transition-colors active:scale-[0.96]"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {navSections.map((section) => {
          // Filter items by permissions — superadmin/dashboard always visible
          const visibleItems = section.items.filter((item) =>
            canDo(adminRole, adminPermissionsMap, item.perm, "view")
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label}>
              {!collapsed && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-charcoal-lighter px-3 mb-1">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive(item.href)
                        ? "bg-primary-light text-charcoal font-medium"
                        : "text-charcoal-lighter hover:bg-pearl hover:text-charcoal"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border/30 p-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-charcoal-lighter hover:bg-pearl hover:text-charcoal transition-colors w-full active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  // Mobile sidebar needs its own instance (a second DOM subtree can't share
  // one JSX element), but it's genuinely mount/unmount-per-toggle already —
  // scroll preservation only matters for the always-mounted desktop sidebar.
  const mobileSidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-[76px] items-center justify-between px-4 border-b border-border/30">
        <Link href="/admin" className="flex items-center gap-1.5">
          <Image src="/logo.png" alt="ChineXa" width={200} height={76} className="h-[64px] w-auto" />
          <span className="text-[9px] text-charcoal-lighter font-body bg-pearl px-1.5 py-0.5 rounded-md">Admin</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {navSections.map((section) => {
          const visibleItems = section.items.filter((item) =>
            canDo(adminRole, adminPermissionsMap, item.perm, "view")
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-charcoal-lighter px-3 mb-1">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive(item.href)
                        ? "bg-primary-light text-charcoal font-medium"
                        : "text-charcoal-lighter hover:bg-pearl hover:text-charcoal"
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border/30 p-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-charcoal-lighter hover:bg-pearl hover:text-charcoal transition-colors w-full active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <AdminContext.Provider value={adminContextValue}>
    <div className="flex h-screen bg-pearl overflow-hidden">
      <Suspense><PageLoader /></Suspense>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border/30 bg-white will-change-[width] shrink-0",
          collapsed ? "w-16" : "w-60"
        )}
        style={{ transition: "width 200ms ease-in-out" }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-charcoal/40 animate-fade-in" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-60 bg-white shadow-luxury-hover animate-slide-in-left">
            {mobileSidebarContent}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="flex h-16 items-center justify-between border-b border-border/30 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-charcoal-lighter hover:text-charcoal transition-colors active:scale-[0.96]"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <AdminNotificationBell />
            <Separator orientation="vertical" className="h-8" />
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 hover:bg-pearl rounded-lg px-2 py-1.5 transition-colors active:scale-[0.98]">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{adminName ? getInitials(adminName) : adminUsername ? getInitials(adminUsername) : "AD"}</AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-charcoal leading-tight">{adminName || adminUsername || "Admin"}</p>
                  <Badge variant={adminRole === "system_admin" ? "gold" : adminRole === "superadmin" ? "destructive" : "secondary"} className="text-[8px] mt-0.5">{adminRole === "system_admin" ? "System Admin" : adminRole === "superadmin" ? "Super Admin" : "Admin"}</Badge>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-3 py-2 border-b border-border/20">
                  <p className="text-sm font-medium text-charcoal">{adminName || adminUsername || "Admin"}</p>
                  <p className="text-[10px] text-charcoal-lighter">@{adminUsername}</p>
                </div>
                <DropdownMenuItem onClick={openProfile}>
                  <User className="h-3.5 w-3.5 mr-2" /> View Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="h-3.5 w-3.5 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={(open) => { if (!open) { setProfileOpen(false); setPwError(""); setCurrentPw(""); setNewPw(""); setConfirmPw(""); } }}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2"><User className="h-5 w-5 text-secondary" /> My Profile</DialogTitle>
            <DialogDescription>View and update your profile information</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Profile Header */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-pearl/60">
              <Avatar className="h-12 w-12"><AvatarFallback className="text-lg font-semibold bg-secondary text-white">{adminName ? getInitials(adminName) : adminUsername ? getInitials(adminUsername) : "AD"}</AvatarFallback></Avatar>
              <div>
                <p className="font-medium text-charcoal">{adminName || adminUsername}</p>
                <div className="flex items-center gap-2">
                  <code className="text-[10px] text-charcoal-lighter">@{adminUsername}</code>
                  <Badge variant={adminRole === "system_admin" ? "gold" : adminRole === "superadmin" ? "destructive" : "secondary"} className="text-[8px]">{adminRole === "system_admin" ? "System Admin" : adminRole === "superadmin" ? "Super Admin" : "Admin"}</Badge>
                </div>
              </div>
            </div>

            {/* Profile Fields — same identity fields as Add Admin, editable by
                the account owner only (server: update_profile is self-only). */}
            <Input label="Full Name" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            <Input label="Username" value={profileUsername} onChange={(e) => { setProfileUsername(e.target.value.toLowerCase().replace(/\s/g, "")); setProfileError(""); }} />
            <Input label="Email" type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} />
            <Input label="Phone" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} />
            {profileError && <p className="text-xs text-destructive">{profileError}</p>}

            <div className="flex justify-end">
              <AdminButton size="sm" onClick={handleSaveProfile} disabled={profileSaving} className={profileSuccess ? "!bg-success" : ""}>
                {profileSaving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                {profileSuccess ? "Saved!" : "Save Profile"}
              </AdminButton>
            </div>

            {/* Change Password Section */}
            <Separator />
            <div>
              <p className="text-sm font-medium text-charcoal flex items-center gap-2 mb-3"><Lock className="h-4 w-4 text-charcoal-lighter" /> Change Password</p>
              <div className="space-y-3">
                <Input label="Current Password" type="password" value={currentPw} onChange={(e) => { setCurrentPw(e.target.value); setPwError(""); }} />
                <Input label="New Password" type="password" placeholder="Min 6 characters" value={newPw} onChange={(e) => { setNewPw(e.target.value); setPwError(""); }} />
                <Input label="Confirm New Password" type="password" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setPwError(""); }} />
                {pwError && <p className="text-xs text-destructive">{pwError}</p>}
                <div className="flex justify-end">
                  <AdminButton size="sm" variant="outline" onClick={handleChangePassword} disabled={pwSaving || !currentPw || !newPw} className={pwSuccess ? "!bg-success !text-white !border-success" : ""}>
                    {pwSaving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                    {pwSuccess ? "Changed!" : "Update Password"}
                  </AdminButton>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </AdminContext.Provider>
  );
}
