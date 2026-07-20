"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  Search, Users, DollarSign, ShoppingCart, TrendingUp, ArrowUpDown,
  ChevronRight, Mail, Phone, Edit,
  MapPin, Package, Clock, CheckCircle2, Truck, XCircle, Calendar,
  ArrowLeft, Loader2, Crown, Gift, Plus, Minus, Tag, Save, Cake, UserCheck, UserRound,
  UserPlus, MessageSquare, Lock, X, Check, Eye
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCellNumeric } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { FieldLabel } from "@/components/admin/shared/field-label";
import { AvatarViewDialog } from "@/components/shared/avatar-view-dialog";
import { resolveTierColorStyle } from "@/lib/tier-color";
import { formatCurrency, formatDateShort, getInitials, cn, collectMissingFields } from "@/lib/utils";
import { useAdmin } from "@/contexts/admin-context";

// ─── Types ────────────────────────────────────────
interface OrderProduct {
  name: string; image: string; qty: number; price: number;
}

interface CustomerOrder {
  id: string; date: string; total: number; items: number;
  status: "pending" | "confirmed" | "processing" | "shipped" | "on_delivery" | "received" | "not_received";
  products: OrderProduct[];
}

interface Customer {
  id: string; name: string; email: string; phone: string; avatar?: string;
  division: string; district: string; address: string;
  totalOrders: number; totalSpent: number; totalItems: number;
  avgOrderValue: number; lastOrderDate: string; joinedDate: string; birthdate: string;
  isActive: boolean; tier: string; accountType: "registered" | "temporary";
  orders: CustomerOrder[];
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "text-warning", bg: "bg-warning/10", icon: Clock },
  confirmed: { label: "Confirmed", color: "text-blue-500", bg: "bg-blue-50", icon: CheckCircle2 },
  processing: { label: "Processing", color: "text-secondary", bg: "bg-secondary/10", icon: Package },
  shipped: { label: "Shipped", color: "text-violet-500", bg: "bg-violet-50", icon: Truck },
  delivered: { label: "Delivered", color: "text-success", bg: "bg-success/10", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
  returned: { label: "Returned", color: "text-orange-500", bg: "bg-orange-50", icon: Package },
};

// Fallback colors for tier names that don't (yet) carry their own `color`
// from /api/membership/tiers — keeps the badge from rendering unstyled.
const fallbackTierColors: Record<string, string> = {
  Bronze: "bg-orange-100 text-orange-700",
  Silver: "bg-gray-100 text-gray-600",
  Gold: "bg-amber-50 text-amber-700",
  Platinum: "bg-violet-50 text-violet-700",
};

type SortKey = "name" | "orders" | "spent" | "lastOrder" | "joined";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : "";
}

export default function AdminCustomersPage() {
  const adminRole = getCookie("chinexa-role");
  const { can } = useAdmin();
  // Password reset and hard-delete stay superadmin-only regardless of
  // granted customers permissions — a deliberately superadmin-exclusive
  // capability, not something a regular admin can be granted.
  const isSuperAdminUser = adminRole === "superadmin";
  const canEditCustomerFields = can("customers", "edit");
  const canDeleteCustomer = can("customers", "delete");
  const canAddCustomer = can("customers", "add");

  // Edit customer dialog
  const [viewAvatarOpen, setViewAvatarOpen] = useState(false);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBirthdate, setEditBirthdate] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  // Superadmin-only: setting a brand new password for this customer —
  // separate field from the rest of the form so it's never sent unless the
  // superadmin actually typed something (an empty new_password would fail
  // the server's own length check anyway, but keeping it opt-in avoids ever
  // building a request that even mentions the password field otherwise).
  const [editResetPassword, setEditResetPassword] = useState(false);
  const [editNewPassword, setEditNewPassword] = useState("");

  // Delete customer (superadmin only)
  const [deleteCustomerDialog, setDeleteCustomerDialog] = useState<"deactivate" | "hard" | null>(null);
  const [deleteCustomerSaving, setDeleteCustomerSaving] = useState(false);
  const [deleteCustomerError, setDeleteCustomerError] = useState("");

  // Add customer dialog
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newSaving, setNewSaving] = useState(false);
  const [newError, setNewError] = useState("");

  // Send SMS dialog
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsSearch, setSmsSearch] = useState("");
  const [smsSearchResults, setSmsSearchResults] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [smsSelected, setSmsSelected] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [smsMessage, setSmsMessage] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  // Result dialog — shown after a send attempt finishes, separate from the
  // compose dialog so success/failure is unmistakable instead of small inline text.
  const [smsResultDialog, setSmsResultDialog] = useState<{
    ok: boolean; title: string; message: string; failedRecipients?: { phone: string; error?: string }[];
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [accountTypeFilter, setAccountTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("spent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [dbCustomers, setDbCustomers] = useState<Customer[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Membership state
  const [membershipData, setMembershipData] = useState<{
    total_points: number;
    tier: { name: string; color: string; min_points: number; max_points: number; points_multiplier: number; benefits: string[]; badge_name: string; badge_color: string; badge_opacity: number; badge_enabled: boolean } | null;
    next_tier: { name: string; min_points: number; max_points: number } | null;
    points_to_next_tier: number;
    history: { id: string; points: number; type: string; description: string; created_at: string }[];
  } | null>(null);
  const [customerCoupons, setCustomerCoupons] = useState<{ id: string; coupon_code: string; coupon_description: string; discount_type: string; discount_value: number; is_used: boolean; valid_until: string }[]>([]);
  const [pointsDialogOpen, setPointsDialogOpen] = useState(false);
  // "give" always adds; "deduct" always subtracts — the admin enters a plain
  // positive number either way, and the sign is applied on submit. Removes
  // the old error-prone pattern of having to type a leading "-" to deduct.
  const [pointsMode, setPointsMode] = useState<"give" | "deduct">("give");
  const [pointsAmount, setPointsAmount] = useState(0);
  const [pointsNote, setPointsNote] = useState("");
  const [pointsNotifTitle, setPointsNotifTitle] = useState("");
  const [pointsNotifMessage, setPointsNotifMessage] = useState("");
  const [pointsType, setPointsType] = useState<"bonus" | "admin_adjustment">("bonus");
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<{ id: string; code: string; description: string; discount_type: string; discount_value: number }[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [tierNames, setTierNames] = useState<string[]>([]);
  const [tierColorMap, setTierColorMap] = useState<Record<string, string>>({});

  // Real configured membership tiers, used to drive the filter dropdown and
  // badge colors instead of the old hardcoded Bronze/Silver/Gold/Platinum list.
  const fetchTierOptions = async () => {
    try {
      const res = await fetch("/api/membership/tiers");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTierNames(data.map((t: { name: string }) => t.name));
        setTierColorMap(Object.fromEntries(data.map((t: { name: string; color?: string }) => [t.name, t.color || ""])));
      }
    } catch {}
  };

  // Fetch customers from DB
  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers?page_size=100");
      const data = await res.json();
      if (data?.data && Array.isArray(data.data)) {
        setDbCustomers(data.data.map((c: Record<string, unknown>) => ({
          id: c.id as string, name: c.name as string, email: (c.email as string) || "",
          phone: c.phone as string, avatar: (c.avatar as string) || undefined, division: "", district: "", address: "",
          totalOrders: Number(c.total_orders) || 0, totalSpent: Number(c.total_spent) || 0,
          totalItems: Number(c.total_items) || 0, avgOrderValue: Number(c.total_orders) > 0 ? Math.round(Number(c.total_spent) / Number(c.total_orders)) : 0,
          lastOrderDate: (c.last_order_at as string) || (c.created_at as string) || "", joinedDate: (c.created_at as string) || "",
          birthdate: (c.birthdate as string) || "",
          isActive: c.is_active !== false, tier: (c.tier as string) || "Bronze",
          accountType: (c.account_type as "registered" | "temporary") || "temporary",
          orders: [],
        })));
      }
    } catch {}
  };
  useEffect(() => { fetchCustomers(); fetchTierOptions(); }, []);

  // Fetch membership data for selected customer
  const fetchMembershipData = async (customerId: string) => {
    try {
      const [pointsRes, couponsRes] = await Promise.all([
        fetch(`/api/customers/${customerId}/points`),
        fetch(`/api/customers/${customerId}/coupons`),
      ]);
      const pointsData = await pointsRes.json();
      const couponsData = await couponsRes.json();
      if (pointsData && !pointsData.error) setMembershipData(pointsData);
      if (Array.isArray(couponsData)) setCustomerCoupons(couponsData);
    } catch {}
  };

  const handleGivePoints = async () => {
    if (!selectedCustomer || !pointsAmount) return;
    const signedPoints = pointsMode === "deduct" ? -Math.abs(pointsAmount) : Math.abs(pointsAmount);
    try {
      await fetch(`/api/customers/${selectedCustomer.id}/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: signedPoints,
          type: pointsType,
          description: pointsNote || `Admin ${pointsMode === "deduct" ? "deduction" : pointsType === "bonus" ? "bonus" : "adjustment"}`,
          notificationTitle: pointsNotifTitle,
          notificationMessage: pointsNotifMessage,
        }),
      });
      setPointsDialogOpen(false);
      setPointsAmount(0);
      setPointsNote("");
      setPointsNotifTitle("");
      setPointsNotifMessage("");
      fetchMembershipData(selectedCustomer.id);
    } catch {}
  };

  const handleAssignCoupon = async () => {
    if (!selectedCustomer || !selectedCouponId) return;
    try {
      await fetch(`/api/customers/${selectedCustomer.id}/coupons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coupon_id: selectedCouponId }),
      });
      setCouponDialogOpen(false);
      setSelectedCouponId("");
      fetchMembershipData(selectedCustomer.id);
    } catch {}
  };

  const openCouponDialog = async () => {
    try {
      const res = await fetch("/api/coupons");
      const data = await res.json();
      if (Array.isArray(data)) setAvailableCoupons(data.filter((c: { is_active: boolean }) => c.is_active));
    } catch {}
    setCouponDialogOpen(true);
  };

  const openEditCustomer = () => {
    if (!selectedCustomer) return;
    setEditName(selectedCustomer.name);
    setEditEmail(selectedCustomer.email);
    setEditPhone(selectedCustomer.phone);
    setEditBirthdate(selectedCustomer.birthdate ? selectedCustomer.birthdate.slice(0, 10) : "");
    setEditActive(selectedCustomer.isActive);
    setEditError("");
    setEditResetPassword(false);
    setEditNewPassword("");
    setEditCustomerOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!selectedCustomer) return;
    setEditError("");
    const missing = collectMissingFields([
      { label: "Full Name", value: editName },
      { label: "Phone", value: editPhone },
    ]);
    if (missing) { setEditError(missing); return; }
    if (editResetPassword && editNewPassword.length < 6) {
      setEditError("New password must be at least 6 characters");
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(), email: editEmail.trim() || null, phone: editPhone.trim(),
          birthdate: editBirthdate || null, is_active: editActive,
          ...(editResetPassword ? { new_password: editNewPassword } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save changes");
      setEditCustomerOpen(false);
      // Update local state
      setSelectedCustomer({ ...selectedCustomer, name: editName.trim(), email: editEmail.trim(), phone: editPhone.trim(), birthdate: editBirthdate, isActive: editActive });
      fetchCustomers();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to save changes");
    } finally { setEditSaving(false); }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer || !deleteCustomerDialog) return;
    setDeleteCustomerError("");
    setDeleteCustomerSaving(true);
    try {
      const hard = deleteCustomerDialog === "hard";
      const res = await fetch(`/api/customers/${selectedCustomer.id}${hard ? "?hard=true" : ""}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to delete customer");
      setDeleteCustomerDialog(null);
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (err: unknown) {
      setDeleteCustomerError(err instanceof Error ? err.message : "Failed to delete customer");
    } finally { setDeleteCustomerSaving(false); }
  };

  const openAddCustomer = () => {
    setNewName(""); setNewEmail(""); setNewPhone(""); setNewPassword("");
    setNewError(""); setAddCustomerOpen(true);
  };

  const handleAddCustomer = async () => {
    setNewError("");
    const missing = collectMissingFields([
      { label: "Full Name", value: newName },
      { label: "Phone", value: newPhone },
      { label: "Password", value: newPassword },
    ]);
    if (missing) { setNewError(missing); return; }
    // Admin-created customers must always be "registered" (a real password),
    // never "temporary" — a temporary/guest-style record has no password and
    // can't sign in at all, so an admin creating one here would just be
    // creating an account the customer could never actually use.
    if (newPassword.length < 6) { setNewError("Password must be at least 6 characters"); return; }

    setNewSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(), email: newEmail.trim() || null, phone: newPhone.trim(),
          account_type: "registered",
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create customer");
      setAddCustomerOpen(false);
      fetchCustomers();
    } catch (err: unknown) {
      setNewError(err instanceof Error ? err.message : "Failed to create customer");
    } finally { setNewSaving(false); }
  };

  const openSmsDialog = () => {
    setSmsSearch(""); setSmsSearchResults([]); setSmsSelected([]); setSmsMessage("");
    setSmsOpen(true);
  };

  const handleSmsSearch = async (q: string) => {
    setSmsSearch(q);
    if (q.length < 2) { setSmsSearchResults([]); return; }
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}&page_size=10`);
      const data = await res.json();
      if (data?.data) setSmsSearchResults(data.data.map((c: Record<string, unknown>) => ({ id: c.id as string, name: c.name as string, phone: c.phone as string })));
    } catch {}
  };

  const toggleSmsSelected = (c: { id: string; name: string; phone: string }) => {
    setSmsSelected((prev) => prev.some((s) => s.id === c.id) ? prev.filter((s) => s.id !== c.id) : [...prev, c]);
  };

  const handleSendSms = async () => {
    if (smsSelected.length === 0 || !smsMessage.trim()) return;
    setSmsSending(true);
    try {
      const res = await fetch("/api/customers/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_ids: smsSelected.map((c) => c.id), message: smsMessage.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send SMS");

      const failedResults: { phone: string; error?: string }[] = Array.isArray(data.results)
        ? data.results.filter((r: { success: boolean }) => !r.success)
        : [];

      if (data.sent === 0) {
        // Request completed, but the gateway rejected every recipient — this
        // is the case the old code mistook for success (it cleared the form
        // and only showed a small easy-to-miss line of text).
        setSmsOpen(false);
        setSmsResultDialog({
          ok: false,
          title: "Message Not Sent",
          message: failedResults[0]?.error || "The SMS gateway rejected all recipients.",
          failedRecipients: failedResults,
        });
        return;
      }

      setSmsOpen(false);
      setSmsResultDialog({
        ok: true,
        title: "Message Sent",
        message: `Delivered to ${data.sent} of ${data.total} recipient${data.total !== 1 ? "s" : ""}${data.failed > 0 ? `. ${data.failed} failed.` : "."}`,
        failedRecipients: data.failed > 0 ? failedResults : undefined,
      });
      setSmsSelected([]);
      setSmsMessage("");
    } catch (err: unknown) {
      setSmsOpen(false);
      setSmsResultDialog({
        ok: false,
        title: "Message Not Sent",
        message: err instanceof Error ? err.message : "Failed to send SMS",
      });
    } finally { setSmsSending(false); }
  };

  // Fetch customer detail with orders when selecting
  const handleSelectCustomer = async (customer: Customer) => {
    setLoadingDetail(true);
    setSelectedCustomer(customer);
    try {
      const res = await fetch(`/api/customers/${customer.id}`);
      const data = await res.json();
      if (data && !data.error) {
        const orders: CustomerOrder[] = (data.orders || []).map((o: Record<string, unknown>) => {
          const items = (o.items as OrderProduct[]) || [];
          return {
            id: (o.order_number as string) || (o.id as string),
            date: (o.created_at as string) || "",
            total: Number(o.total),
            items: items.length,
            status: (o.status as CustomerOrder["status"]) || "pending",
            products: items,
          };
        });
        // Update address info from detail
        const addr = data.addresses?.[0];
        setSelectedCustomer({
          ...customer,
          address: addr ? [addr.address_line_1, addr.district, addr.division].filter(Boolean).join(", ") : customer.address,
          division: addr?.division || "",
          district: addr?.district || "",
          birthdate: (data.birthdate as string) || customer.birthdate,
          accountType: (data.account_type as "registered" | "temporary") || customer.accountType,
          orders,
        });
      }
    } catch {} finally { setLoadingDetail(false); }
    fetchMembershipData(customer.id);
  };

  // Use DB data
  const activeCustomers = dbCustomers;

  // Filter + Sort
  const filtered = useMemo(() => {
    let list = [...activeCustomers];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q));
    }
    if (statusFilter === "active") list = list.filter((c) => c.isActive);
    if (statusFilter === "inactive") list = list.filter((c) => !c.isActive);
    if (tierFilter !== "all") list = list.filter((c) => c.tier === tierFilter);
    if (accountTypeFilter !== "all") list = list.filter((c) => c.accountType === accountTypeFilter);

    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "orders") cmp = a.totalOrders - b.totalOrders;
      else if (sortBy === "spent") cmp = a.totalSpent - b.totalSpent;
      else if (sortBy === "lastOrder") cmp = new Date(a.lastOrderDate).getTime() - new Date(b.lastOrderDate).getTime();
      else if (sortBy === "joined") cmp = new Date(a.joinedDate).getTime() - new Date(b.joinedDate).getTime();
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [activeCustomers, searchQuery, statusFilter, tierFilter, accountTypeFilter, sortBy, sortDir]);

  // CSV export (opens correctly in Excel/Google Sheets/Numbers) — respects
  // whatever search/filters are currently applied, matching what's on screen.
  const handleExport = () => {
    const headers = [
      "Name", "Phone", "Email", "Account Type", "Tier", "Status",
      "Total Orders", "Total Items", "Total Spent", "Avg Order Value",
      "Last Order Date", "Joined Date", "Birthdate", "Division", "District", "Address",
    ];
    const escapeCsv = (val: string | number) => {
      const s = String(val ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filtered.map((c) => [
      c.name, c.phone, c.email,
      c.accountType === "registered" ? "Registered" : "Temporary",
      c.tier, c.isActive ? "Active" : "Inactive",
      c.totalOrders, c.totalItems, c.totalSpent, c.avgOrderValue,
      c.lastOrderDate ? formatDateShort(c.lastOrderDate) : "",
      c.joinedDate ? formatDateShort(c.joinedDate) : "",
      c.birthdate ? formatDateShort(c.birthdate) : "",
      c.division, c.district, c.address,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    // BOM so Excel opens UTF-8 (৳, names with non-Latin characters) correctly
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortDir("desc"); }
  };

  const totalRevenue = activeCustomers.reduce((s, c) => s + c.totalSpent, 0);
  const totalOrders = activeCustomers.reduce((s, c) => s + c.totalOrders, 0);
  const avgLifetimeValue = activeCustomers.length > 0 ? Math.round(totalRevenue / activeCustomers.length) : 0;

  // ─── CUSTOMER DETAIL PANEL ───
  if (selectedCustomer) {
    const c = selectedCustomer;
    const tierName = membershipData?.tier?.name || c.tier;
    const tierColor = resolveTierColorStyle(membershipData?.tier?.color || tierColorMap[c.tier] || fallbackTierColors[c.tier]);
    const tierBadgeShown = membershipData?.tier?.badge_enabled && membershipData.tier.badge_color;
    const totalPoints = membershipData?.total_points || 0;
    const nextTier = membershipData?.next_tier;
    // Guard divide-by-zero when a tier has min_points === max_points
    const tierRange = membershipData?.tier ? membershipData.tier.max_points - membershipData.tier.min_points : 0;
    const rawProgress = membershipData?.tier && tierRange > 0
      ? ((totalPoints - membershipData.tier.min_points) / tierRange) * 100
      : 0;
    const progressPercent = Number.isFinite(rawProgress) ? Math.max(0, Math.min(100, rawProgress)) : 0;

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setSelectedCustomer(null); setMembershipData(null); setCustomerCoupons([]); }} className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors active:scale-[0.96]">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="font-heading text-xl font-semibold text-charcoal">{c.name}</h1>
            <p className="text-xs text-charcoal-lighter">Customer since {formatDateShort(c.joinedDate)}</p>
          </div>
          <Badge variant={c.accountType === "registered" ? "success" : "outline"} className="text-[10px]">
            {c.accountType === "registered" ? <UserCheck className="h-3 w-3 mr-1" /> : <UserRound className="h-3 w-3 mr-1" />}
            {c.accountType === "registered" ? "Registered" : "Temporary"}
          </Badge>
          <Badge className={cn("text-[10px]", tierColor.className)} style={tierColor.style}><Crown className="h-3 w-3 mr-1" />{tierName}</Badge>
          {tierBadgeShown && <VerifiedBadge color={membershipData!.tier!.badge_color} opacity={membershipData!.tier!.badge_opacity} size={18} tooltip={membershipData!.tier!.badge_name} />}
          <Badge variant={c.isActive ? "success" : "destructive"} className="text-[10px]">{c.isActive ? "Active" : "Inactive"}</Badge>
          {canEditCustomerFields && (
            <AdminButton variant="outline" size="xs" onClick={openEditCustomer}>
              <Edit className="h-3 w-3" /> Edit
            </AdminButton>
          )}
          {canDeleteCustomer && (
            <AdminButton variant="danger" size="xs" onClick={() => { setDeleteCustomerError(""); setDeleteCustomerDialog("deactivate"); }}>
              <XCircle className="h-3 w-3" /> Delete
            </AdminButton>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left: Profile + Membership + Stats */}
          <div className="space-y-5">
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-col items-center text-center mb-4">
                  <button
                    type="button"
                    onClick={() => c.avatar && setViewAvatarOpen(true)}
                    className={cn("group relative mb-3", c.avatar && "cursor-pointer active:scale-[0.97] transition-transform")}
                    aria-label={c.avatar ? "View profile picture" : undefined}
                    disabled={!c.avatar}
                  >
                    <Avatar className="h-16 w-16 ring-2 ring-primary-light">{c.avatar && <AvatarImage src={c.avatar} alt={c.name} />}<AvatarFallback className="text-xl font-semibold bg-secondary text-white">{getInitials(c.name)}</AvatarFallback></Avatar>
                    {c.avatar && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-charcoal/0 group-hover:bg-charcoal/40 transition-colors">
                        <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    )}
                  </button>
                  <h2 className="font-heading text-lg font-semibold text-charcoal flex items-center gap-1.5">
                    {c.name}
                    {tierBadgeShown && <VerifiedBadge color={membershipData!.tier!.badge_color} opacity={membershipData!.tier!.badge_opacity} size={18} tooltip={membershipData!.tier!.badge_name} />}
                  </h2>
                  <Badge className={cn("text-[9px] mt-1", tierColor.className)} style={tierColor.style}>{tierName} Member</Badge>
                </div>
                <Separator className="my-3" />
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2 text-charcoal-lighter"><Phone className="h-3.5 w-3.5 text-secondary" /> {c.phone}</div>
                  {c.email && <div className="flex items-center gap-2 text-charcoal-lighter"><Mail className="h-3.5 w-3.5 text-secondary" /> {c.email}</div>}
                  {c.address && <div className="flex items-start gap-2 text-charcoal-lighter"><MapPin className="h-3.5 w-3.5 text-secondary mt-0.5" /> {c.address}</div>}
                  <div className="flex items-center gap-2 text-charcoal-lighter"><Calendar className="h-3.5 w-3.5 text-secondary" /> Joined {formatDateShort(c.joinedDate)}</div>
                  {c.birthdate && <div className="flex items-center gap-2 text-charcoal-lighter"><Cake className="h-3.5 w-3.5 text-secondary" /> Born {formatDateShort(c.birthdate)}</div>}
                </div>
              </CardContent>
            </Card>

            {/* Membership & Points Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Crown className="h-4 w-4 text-gold" /> Loyalty Points</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <p className="text-3xl font-bold text-charcoal [font-variant-numeric:tabular-nums]">{totalPoints.toLocaleString()}</p>
                  <p className="text-[10px] text-charcoal-lighter">total points</p>
                </div>
                {membershipData?.tier && (
                  <div>
                    <div className="flex justify-between text-[10px] text-charcoal-lighter mb-1">
                      <span>{membershipData.tier.name} ({membershipData.tier.min_points})</span>
                      <span>{nextTier ? `${nextTier.name} (${nextTier.min_points})` : "Max Tier"}</span>
                    </div>
                    <Progress value={Math.min(progressPercent, 100)} />
                    {nextTier && (
                      <p className="text-[9px] text-charcoal-lighter mt-1 text-center">
                        {membershipData.points_to_next_tier} points to {nextTier.name}
                      </p>
                    )}
                  </div>
                )}
                {membershipData?.tier?.points_multiplier && membershipData.tier.points_multiplier > 1 && (
                  <p className="text-[10px] text-center text-secondary font-medium">
                    {membershipData.tier.points_multiplier}x points multiplier active
                  </p>
                )}
                {canEditCustomerFields && (
                <div className="flex gap-2">
                  <AdminButton
                    variant="outline"
                    size="xs"
                    className="flex-1"
                    onClick={() => { setPointsMode("give"); setPointsType("bonus"); setPointsAmount(0); setPointsNote(""); setPointsNotifTitle(""); setPointsNotifMessage(""); setPointsDialogOpen(true); }}
                  >
                    <Plus className="h-3 w-3" /> Give Points
                  </AdminButton>
                  <AdminButton
                    variant="outline"
                    size="xs"
                    className="flex-1"
                    onClick={() => { setPointsMode("deduct"); setPointsType("admin_adjustment"); setPointsAmount(0); setPointsNote(""); setPointsNotifTitle(""); setPointsNotifMessage(""); setPointsDialogOpen(true); }}
                    disabled={!membershipData?.total_points}
                  >
                    <Minus className="h-3 w-3" /> Deduct Points
                  </AdminButton>
                </div>
                )}
                <AdminButton variant="outline" size="xs" className="w-full" onClick={openCouponDialog}>
                  <Gift className="h-3 w-3" /> Assign Coupon
                </AdminButton>
              </CardContent>
            </Card>

            {/* Assigned Coupons */}
            {customerCoupons.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Tag className="h-4 w-4 text-secondary" /> Assigned Coupons</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {customerCoupons.map((cc) => (
                    <div key={cc.id} className="flex items-center justify-between p-2 rounded-lg bg-pearl/40">
                      <div>
                        <p className="text-xs font-semibold text-charcoal">{cc.coupon_code}</p>
                        <p className="text-[9px] text-charcoal-lighter">{cc.discount_type === "percentage" ? `${cc.discount_value}% off` : `${formatCurrency(cc.discount_value)} off`}</p>
                      </div>
                      <Badge variant={cc.is_used ? "destructive" : "success"} className="text-[9px]">{cc.is_used ? "Used" : "Active"}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Orders", value: c.totalOrders, icon: ShoppingCart, color: "text-secondary bg-secondary/10" },
                { label: "Items Bought", value: c.totalItems, icon: Package, color: "text-blue-500 bg-blue-50" },
                { label: "Total Spent", value: formatCurrency(c.totalSpent), icon: DollarSign, color: "text-success bg-success/10" },
                { label: "Avg. Order", value: formatCurrency(c.avgOrderValue), icon: TrendingUp, color: "text-gold bg-gold/10" },
              ].map((s) => (
                <Card key={s.label}><CardContent className="p-3 text-center">
                  <div className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg mb-1.5", s.color)}><s.icon className="h-3.5 w-3.5" /></div>
                  <p className="text-base font-bold text-charcoal truncate [font-variant-numeric:tabular-nums]">{s.value}</p>
                  <p className="text-[9px] text-charcoal-lighter">{s.label}</p>
                </CardContent></Card>
              ))}
            </div>
          </div>

          {/* Right: Points History + Order History */}
          <div className="lg:col-span-2 space-y-5">
            {/* Points History */}
            {membershipData?.history && membershipData.history.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Points History</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {membershipData.history.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0">
                        <div>
                          <p className="text-xs text-charcoal">{entry.description || entry.type}</p>
                          <p className="text-[9px] text-charcoal-lighter">{formatDateShort(entry.created_at)}</p>
                        </div>
                        <span className={cn("text-sm font-semibold", entry.points > 0 ? "text-success" : "text-destructive")}>
                          {entry.points > 0 ? "+" : ""}{entry.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order History */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Order History ({c.orders.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {loadingDetail && c.orders.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-charcoal-lighter">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading orders...
                  </div>
                )}
                {!loadingDetail && c.orders.length === 0 && (
                  <p className="text-sm text-charcoal-lighter text-center py-8">No orders found for this customer</p>
                )}
                {c.orders.map((order) => {
                  const sc = statusConfig[order.status] || { label: order.status, color: "text-charcoal-lighter", bg: "bg-pearl", icon: Clock };
                  const Icon = sc.icon;
                  return (
                    <div key={order.id} className="rounded-luxury border border-border/20 overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-pearl/40">
                        <div className="flex items-center gap-4 text-xs min-w-0">
                          <div className="min-w-0"><p className="text-[9px] text-charcoal-lighter uppercase">Order</p><p className="font-semibold text-charcoal truncate">{order.id}</p></div>
                          <div className="hidden sm:block shrink-0"><p className="text-[9px] text-charcoal-lighter uppercase">Date</p><p className="text-charcoal">{formatDateShort(order.date)}</p></div>
                          <div className="shrink-0"><p className="text-[9px] text-charcoal-lighter uppercase">Total</p><p className="font-semibold text-charcoal">{formatCurrency(order.total)}</p></div>
                        </div>
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0", sc.color, sc.bg)}>
                          <Icon className="h-3 w-3" /> {sc.label}
                        </span>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        {order.products.map((p, i) => (
                          <div key={i} className="flex items-center gap-3">
                            {p.image && (
                              <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-pearl shrink-0">
                                <Image src={p.image} alt={p.name} fill className="object-cover" sizes="40px" unoptimized={p.image.includes("/uploads/")} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-charcoal truncate">{p.name}</p>
                              <p className="text-[10px] text-charcoal-lighter">Qty: {p.qty}</p>
                            </div>
                            <p className="text-xs font-medium text-charcoal shrink-0">{formatCurrency(p.price)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Give/Deduct Points Dialog */}
        <Dialog open={pointsDialogOpen} onOpenChange={setPointsDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{pointsMode === "deduct" ? "Deduct Points" : pointsType === "bonus" ? "Give Bonus Points" : "Adjust Points"}</DialogTitle>
              <DialogDescription>
                {pointsMode === "deduct"
                  ? `Remove points from ${c.name}'s balance (currently ${membershipData?.total_points || 0})`
                  : `Add points to ${c.name}'s balance`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {pointsMode === "give" && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPointsType("bonus")} className={cn("flex-1 py-2 rounded-lg text-xs font-medium border transition-all active:scale-[0.97]", pointsType === "bonus" ? "border-secondary bg-secondary/10 text-secondary" : "border-border/30 text-charcoal-lighter")}>Bonus</button>
                  <button type="button" onClick={() => setPointsType("admin_adjustment")} className={cn("flex-1 py-2 rounded-lg text-xs font-medium border transition-all active:scale-[0.97]", pointsType === "admin_adjustment" ? "border-secondary bg-secondary/10 text-secondary" : "border-border/30 text-charcoal-lighter")}>Adjustment</button>
                </div>
              )}
              <Input
                label="Points"
                required
                type="number"
                min={0}
                max={pointsMode === "deduct" ? (membershipData?.total_points || 0) : undefined}
                value={pointsAmount || ""}
                onChange={(e) => setPointsAmount(Math.max(0, Number(e.target.value)))}
                placeholder="e.g. 100"
              />
              {pointsMode === "deduct" && pointsAmount > (membershipData?.total_points || 0) && (
                <p className="text-[11px] text-destructive">Can&apos;t deduct more than the customer&apos;s current balance ({membershipData?.total_points || 0}).</p>
              )}
              <Input label="Reason" value={pointsNote} onChange={(e) => setPointsNote(e.target.value)} placeholder={pointsMode === "deduct" ? "e.g. Return abuse, order cancelled" : "e.g. Birthday bonus"} />
              <div className="pt-1 border-t border-border/30 space-y-2">
                <p className="text-[11px] font-medium text-charcoal-lighter uppercase tracking-wide"><FieldLabel label="Customer Notification" hint="Sent to the customer as a notification. Leave blank to use the default text shown above." /></p>
                <Input
                  label="Title"
                  value={pointsNotifTitle}
                  onChange={(e) => setPointsNotifTitle(e.target.value)}
                  placeholder={pointsMode === "deduct" ? "Points deducted from your account" : "Points added to your account"}
                />
                <Textarea
                  label="Description"
                  value={pointsNotifMessage}
                  onChange={(e) => setPointsNotifMessage(e.target.value)}
                  placeholder={`${Math.abs(pointsAmount) || "X"} points were ${pointsMode === "deduct" ? "deducted from" : "added to"} your account.`}
                  className="min-h-[60px]"
                />
              </div>
            </div>
            <DialogFooter>
              <AdminButton variant="ghost" size="xs" onClick={() => setPointsDialogOpen(false)}>Cancel</AdminButton>
              <AdminButton
                variant={pointsMode === "deduct" ? "danger" : "primary"}
                size="xs"
                onClick={handleGivePoints}
                disabled={!pointsAmount || (pointsMode === "deduct" && pointsAmount > (membershipData?.total_points || 0))}
              >
                {pointsMode === "deduct" ? "Deduct" : "Give"} {Math.abs(pointsAmount)} Points
              </AdminButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Coupon Dialog */}
        <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Assign Coupon</DialogTitle>
              <DialogDescription>Select a coupon to assign to {c.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2 max-h-64 overflow-y-auto">
              {availableCoupons.length === 0 ? (
                <p className="text-sm text-charcoal-lighter text-center py-4">No active coupons available</p>
              ) : availableCoupons.map((coupon) => (
                <button
                  key={coupon.id}
                  type="button"
                  onClick={() => setSelectedCouponId(coupon.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left active:scale-[0.98]",
                    selectedCouponId === coupon.id ? "border-secondary bg-secondary/5" : "border-border/30 hover:bg-pearl/50"
                  )}
                >
                  <div>
                    <p className="text-xs font-semibold text-charcoal">{coupon.code}</p>
                    <p className="text-[9px] text-charcoal-lighter">{coupon.description || `${coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : formatCurrency(coupon.discount_value)} off`}</p>
                  </div>
                  <Badge className="text-[9px]">{coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : formatCurrency(coupon.discount_value)}</Badge>
                </button>
              ))}
            </div>
            <DialogFooter>
              <AdminButton variant="ghost" size="xs" onClick={() => setCouponDialogOpen(false)}>Cancel</AdminButton>
              <AdminButton variant="primary" size="xs" onClick={handleAssignCoupon} disabled={!selectedCouponId}>
                Assign Coupon
              </AdminButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Customer Dialog */}
        <Dialog open={editCustomerOpen} onOpenChange={setEditCustomerOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-secondary" /> Edit Customer</DialogTitle>
              <DialogDescription>Update customer profile details</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Input label="Full Name" required value={editName} onChange={(e) => setEditName(e.target.value)} />
              <Input label="Email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              <Input label="Phone" required value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              <Input label="Birthdate" type="date" value={editBirthdate} onChange={(e) => setEditBirthdate(e.target.value)} />
              <div className="flex items-center gap-3">
                <Switch checked={editActive} onCheckedChange={setEditActive} />
                <span className="text-sm text-charcoal-lighter">{editActive ? "Active" : "Inactive"}</span>
              </div>

              {isSuperAdminUser && (
                <div className="pt-2 border-t border-border/30 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Switch checked={editResetPassword} onCheckedChange={(v) => { setEditResetPassword(v); if (!v) setEditNewPassword(""); }} />
                    <span className="text-sm text-charcoal-lighter">Set a new password for this customer</span>
                  </label>
                  {editResetPassword && (
                    <Input
                      label="New Password"
                      type="password"
                      value={editNewPassword}
                      onChange={(e) => setEditNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      icon={<Lock className="h-4 w-4" />}
                    />
                  )}
                </div>
              )}

              {editError && <p className="text-xs text-destructive">{editError}</p>}
            </div>
            <DialogFooter>
              <AdminButton variant="ghost" size="xs" onClick={() => setEditCustomerOpen(false)}>Cancel</AdminButton>
              <AdminButton variant="primary" size="xs" onClick={handleSaveCustomer} disabled={editSaving || !editName.trim() || (editResetPassword && editNewPassword.length < 6)}>
                {editSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
              </AdminButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Customer Dialog — superadmin only, offers a choice between
            reversible deactivation and permanent removal. */}
        <Dialog open={deleteCustomerDialog !== null} onOpenChange={(open) => !open && setDeleteCustomerDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive"><XCircle className="h-5 w-5" /> Delete Customer</DialogTitle>
              <DialogDescription>
                {deleteCustomerDialog === "hard"
                  ? "This permanently removes the customer and cannot be undone. Their order history stays on record, but the account itself is gone."
                  : "Deactivating disables the account (reversible) without deleting any data. Choose \"Delete Permanently\" instead if you want to remove the account entirely."}
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteCustomerDialog("deactivate")}
                  className={cn("flex-1 px-3 py-2 rounded-xl border text-xs font-medium transition-all active:scale-[0.97]", deleteCustomerDialog === "deactivate" ? "border-secondary bg-secondary/5 text-secondary" : "border-border/40 text-charcoal-lighter")}
                >
                  Deactivate (reversible)
                </button>
                {isSuperAdminUser && (
                  <button
                    onClick={() => setDeleteCustomerDialog("hard")}
                    className={cn("flex-1 px-3 py-2 rounded-xl border text-xs font-medium transition-all active:scale-[0.97]", deleteCustomerDialog === "hard" ? "border-destructive bg-destructive/5 text-destructive" : "border-border/40 text-charcoal-lighter")}
                  >
                    Delete Permanently
                  </button>
                )}
              </div>
              {deleteCustomerError && <p className="text-xs text-destructive">{deleteCustomerError}</p>}
            </div>
            <DialogFooter>
              <AdminButton variant="ghost" size="xs" onClick={() => setDeleteCustomerDialog(null)}>Cancel</AdminButton>
              <AdminButton
                variant="danger"
                size="xs"
                onClick={handleDeleteCustomer}
                disabled={deleteCustomerSaving}
              >
                {deleteCustomerSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                {deleteCustomerDialog === "hard" ? "Delete Permanently" : "Deactivate"}
              </AdminButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {c.avatar && <AvatarViewDialog open={viewAvatarOpen} onOpenChange={setViewAvatarOpen} imageUrl={c.avatar} name={c.name} />}
      </div>
    );
  }

  // ─── CUSTOMER LIST ───
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Customers</h1>
          <p className="text-sm text-charcoal-lighter">{activeCustomers.length} registered · {formatCurrency(totalRevenue)} lifetime revenue</p>
        </div>
        <div className="flex gap-2">
          <AdminButton variant="outline" size="sm" onClick={openSmsDialog}><MessageSquare className="h-3.5 w-3.5" /> Send SMS</AdminButton>
          {canAddCustomer && <AdminButton size="sm" onClick={openAddCustomer}><UserPlus className="h-3.5 w-3.5" /> Add Customer</AdminButton>}
          <AdminButton variant="outline" size="sm" onClick={handleExport}><Users className="h-3.5 w-3.5" /> Export</AdminButton>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Customers", value: activeCustomers.length, icon: Users, color: "text-secondary bg-secondary/10" },
          { label: "Total Orders", value: totalOrders, icon: ShoppingCart, color: "text-blue-500 bg-blue-50" },
          { label: "Revenue", value: formatCurrency(totalRevenue), icon: DollarSign, color: "text-success bg-success/10" },
          { label: "Avg. LTV", value: formatCurrency(avgLifetimeValue), icon: TrendingUp, color: "text-gold bg-gold/10" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-3 flex items-center gap-2.5">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl shrink-0", s.color)}><s.icon className="h-4 w-4" /></div>
            <div><p className="text-lg font-bold text-charcoal leading-tight [font-variant-numeric:tabular-nums]">{s.value}</p><p className="text-[9px] text-charcoal-lighter">{s.label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <div className="p-3 border-b border-border/20">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="Search name, phone, email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} icon={<Search className="h-4 w-4" />} className="flex-1" />
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  {tierNames.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  <SelectItem value="registered">Registered</SelectItem>
                  <SelectItem value="temporary">Temporary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={activeCustomers.length === 0 ? "No customers yet" : "No customers match your search"}
            description={activeCustomers.length === 0 ? "Customers will appear here when they register or place an order." : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Customer</TableHead>
                <TableHead className="hidden sm:table-cell">Account</TableHead>
                <TableHead className="hidden sm:table-cell">
                  <button onClick={() => toggleSort("orders")} className="flex items-center gap-1 hover:text-charcoal transition-colors active:scale-[0.96]">
                    Orders <ArrowUpDown className={cn("h-3 w-3", sortBy === "orders" && "text-secondary")} />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("spent")} className="flex items-center gap-1 hover:text-charcoal transition-colors active:scale-[0.96]">
                    Spent <ArrowUpDown className={cn("h-3 w-3", sortBy === "spent" && "text-secondary")} />
                  </button>
                </TableHead>
                <TableHead className="hidden md:table-cell">Tier</TableHead>
                <TableHead className="hidden lg:table-cell">
                  <button onClick={() => toggleSort("lastOrder")} className="flex items-center gap-1 hover:text-charcoal transition-colors active:scale-[0.96]">
                    Last Order <ArrowUpDown className={cn("h-3 w-3", sortBy === "lastOrder" && "text-secondary")} />
                  </button>
                </TableHead>
                <TableHead className="hidden xl:table-cell">
                  <button onClick={() => toggleSort("joined")} className="flex items-center gap-1 hover:text-charcoal transition-colors active:scale-[0.96]">
                    Joined <ArrowUpDown className={cn("h-3 w-3", sortBy === "joined" && "text-secondary")} />
                  </button>
                </TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} onClick={() => handleSelectCustomer(c)} className="cursor-pointer group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0">{c.avatar && <AvatarImage src={c.avatar} alt={c.name} />}<AvatarFallback className="text-[10px] font-semibold">{getInitials(c.name)}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-charcoal text-sm truncate">{c.name}</p>
                        <p className="text-[10px] text-charcoal-lighter">{c.phone}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={c.accountType === "registered" ? "success" : "outline"} className="text-[9px]">
                      {c.accountType === "registered" ? "Registered" : "Temporary"}
                    </Badge>
                  </TableCell>
                  <TableCellNumeric className="hidden sm:table-cell">
                    <p className="font-semibold text-charcoal">{c.totalOrders}</p>
                    <p className="text-[9px] text-charcoal-lighter">{c.totalItems} items</p>
                  </TableCellNumeric>
                  <TableCellNumeric>
                    <p className="font-semibold text-charcoal">{formatCurrency(c.totalSpent)}</p>
                    <p className="text-[9px] text-charcoal-lighter">Avg {formatCurrency(c.avgOrderValue)}</p>
                  </TableCellNumeric>
                  <TableCell className="hidden md:table-cell">
                    {(() => {
                      const rowTierColor = resolveTierColorStyle(tierColorMap[c.tier] || fallbackTierColors[c.tier]);
                      return <Badge className={cn("text-[9px]", rowTierColor.className)} style={rowTierColor.style}>{c.tier}</Badge>;
                    })()}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-charcoal-lighter">
                    {formatDateShort(c.lastOrderDate)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-xs text-charcoal-lighter">
                    {c.joinedDate ? formatDateShort(c.joinedDate) : "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={c.isActive ? "success" : "destructive"} className="text-[9px]">{c.isActive ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-charcoal-lighter transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-secondary" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Add Customer Dialog */}
      <Dialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-secondary" /> Add Customer</DialogTitle>
            <DialogDescription>Create a new customer account</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input label="Full Name" required value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input label="Phone" required value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+8801XXXXXXXXX" />
            <Input label="Email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Input
              label="Password"
              required
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              icon={<Lock className="h-4 w-4" />}
            />
            {newError && <p className="text-xs text-destructive">{newError}</p>}
          </div>
          <DialogFooter>
            <AdminButton variant="ghost" size="xs" onClick={() => setAddCustomerOpen(false)}>Cancel</AdminButton>
            <AdminButton
              variant="primary"
              size="xs"
              onClick={handleAddCustomer}
              disabled={newSaving || !newName.trim() || !newPhone.trim() || newPassword.length < 6}
            >
              {newSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />} Create
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send SMS Dialog */}
      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-secondary" /> Send SMS</DialogTitle>
            <DialogDescription>Search and select customers to message</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-2">
            {smsSelected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {smsSelected.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary text-[11px] font-medium">
                    {c.name}
                    <button type="button" onClick={() => toggleSmsSelected(c)} className="hover:text-destructive transition-colors active:scale-[0.9]">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 px-3 rounded-xl border border-border bg-pearl/30">
              <Search className="h-3.5 w-3.5 text-charcoal-lighter shrink-0" />
              <input
                type="text"
                value={smsSearch}
                onChange={(e) => handleSmsSearch(e.target.value)}
                placeholder="Search by name or phone number..."
                className="w-full py-2.5 text-sm bg-transparent outline-none text-charcoal placeholder:text-charcoal-lighter/50"
              />
            </div>
            {smsSearchResults.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-border/30 rounded-xl bg-white">
                {smsSearchResults.map((r) => {
                  const isSelected = smsSelected.some((s) => s.id === r.id);
                  return (
                    <button key={r.id} type="button" onClick={() => toggleSmsSelected(r)}
                      className={cn("w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-pearl transition-colors active:scale-[0.99]", isSelected && "bg-secondary/5")}>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-charcoal truncate">{r.name}</p>
                        <p className="text-[10px] text-charcoal-lighter truncate">{r.phone}</p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-secondary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
            <Textarea
              label={`Message${smsSelected.length > 0 ? ` (to ${smsSelected.length} recipient${smsSelected.length > 1 ? "s" : ""})` : ""}`}
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[90px]"
            />
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <AdminButton variant="ghost" size="xs" onClick={() => setSmsOpen(false)}>Close</AdminButton>
            <AdminButton
              variant="primary"
              size="xs"
              onClick={handleSendSms}
              disabled={smsSending || smsSelected.length === 0 || !smsMessage.trim()}
            >
              {smsSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />} Send
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send SMS Result Dialog — success or error, always shown after a send attempt */}
      <Dialog open={!!smsResultDialog} onOpenChange={(open) => !open && setSmsResultDialog(null)}>
        <DialogContent className="max-w-sm">
          {smsResultDialog && (
            <>
              <DialogHeader>
                <div className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full mb-2",
                  smsResultDialog.ok ? "bg-success/10" : "bg-destructive/10"
                )}>
                  {smsResultDialog.ok
                    ? <Check className="h-5 w-5 text-success" />
                    : <X className="h-5 w-5 text-destructive" />}
                </div>
                <DialogTitle className={smsResultDialog.ok ? "text-success" : "text-destructive"}>
                  {smsResultDialog.title}
                </DialogTitle>
                <DialogDescription>{smsResultDialog.message}</DialogDescription>
              </DialogHeader>
              {smsResultDialog.failedRecipients && smsResultDialog.failedRecipients.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-xl bg-pearl/50 p-2 space-y-1">
                  {smsResultDialog.failedRecipients.map((r, i) => (
                    <p key={i} className="text-[11px] text-charcoal-lighter">
                      <span className="font-medium text-charcoal">{r.phone}</span> — {r.error || "Failed"}
                    </p>
                  ))}
                </div>
              )}
              <DialogFooter>
                <AdminButton variant="primary" size="xs" onClick={() => setSmsResultDialog(null)}>
                  OK
                </AdminButton>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
