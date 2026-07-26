"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Star, Check, X, MessageSquare, Trash2, Loader2, MoreHorizontal,
  MessageSquareText, Clock, CheckCircle2, Search, Package, Tag, User, ChevronLeft,
} from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, getInitials, formatDateShort } from "@/lib/utils";
import { useAdmin } from "@/contexts/admin-context";
import { ReviewImageGallery } from "@/components/storefront/reviews/review-image-gallery";

// The API returns SELECT * — product_id and customer_id are always present even
// though the older UI didn't type them. They power the By-Product / By-Person /
// By-Brand grouping views (all client-side over the single fetched list).
interface ReviewData {
  id: string; product_id: string; customer_id: string | null;
  customer_name: string; product_name: string; rating: number;
  title: string | null; comment: string; images?: string[]; is_verified_purchase: boolean;
  is_approved: boolean; admin_reply: string | null; created_at: string;
  customer_tier?: string | null; customer_tier_color?: string | null;
}

type Mode = "moderate" | "product" | "brand" | "person";

const TIER_FALLBACK = "#7A4FA0";

// ─────────────────────────────────────────────────────────────────────────────
// Small shared pieces
// ─────────────────────────────────────────────────────────────────────────────

function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "xs" }) {
  const cls = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn(cls, i < Math.round(value) ? "text-gold fill-gold" : "text-border")} />
      ))}
    </div>
  );
}

function TierBadge({ tier, color }: { tier?: string | null; color?: string | null }) {
  if (!tier) return null;
  const c = color || TIER_FALLBACK;
  return (
    <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide shrink-0"
      style={{ backgroundColor: `${c}18`, color: c }}>{tier}</span>
  );
}

// Compact horizontal bar for a rating-distribution histogram (5★ → 1★).
function RatingHistogram({ counts, total }: { counts: number[]; total: number }) {
  return (
    <div className="space-y-1">
      {[5, 4, 3, 2, 1].map((star) => {
        const n = counts[star - 1] || 0;
        const pct = total > 0 ? (n / total) * 100 : 0;
        return (
          <div key={star} className="flex items-center gap-2">
            <span className="flex items-center gap-0.5 text-[10px] text-charcoal-lighter w-6 shrink-0 [font-variant-numeric:tabular-nums]">{star}<Star className="h-2.5 w-2.5 text-gold fill-gold" /></span>
            <div className="flex-1 h-1.5 rounded-full bg-pearl overflow-hidden">
              <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-charcoal-lighter w-6 text-right shrink-0 [font-variant-numeric:tabular-nums]">{n}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminReviewsPage() {
  const { can } = useAdmin();
  const canApproveReview = can("reviews", "approve");
  const canDeleteReview = can("reviews", "delete");

  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("moderate");
  const [search, setSearch] = useState("");

  // Product-id → brand name map (for the By-Brand view). Fetched once from the
  // products API by the distinct product ids present in the reviews list, since
  // reviews carry no brand column of their own.
  const [brandByProduct, setBrandByProduct] = useState<Record<string, string>>({});

  // dialogs
  const [replyDialog, setReplyDialog] = useState<ReviewData | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySaving, setReplySaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<ReviewData | null>(null);

  // drill-down selection for By-Product / By-Person
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null); // customer_id

  const fetchReviews = async () => {
    try {
      const res = await fetch("/api/reviews?limit=200");
      const data = await res.json();
      setReviews(Array.isArray(data) ? data : []);
    } catch { /* keep empty */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchReviews(); }, []);

  // Once reviews are loaded, resolve each product's brand for the By-Brand view.
  useEffect(() => {
    const ids = Array.from(new Set(reviews.map((r) => r.product_id).filter(Boolean)));
    if (ids.length === 0) return;
    (async () => {
      try {
        const map: Record<string, string> = {};
        // The products API accepts up to 100 ids per call — chunk defensively.
        for (let i = 0; i < ids.length; i += 100) {
          const chunk = ids.slice(i, i + 100);
          const res = await fetch(`/api/products?ids=${chunk.map(encodeURIComponent).join(",")}`);
          const json = await res.json();
          for (const p of (json?.data || [])) {
            if (p?.id) map[p.id] = p.brand_name || "No Brand";
          }
        }
        setBrandByProduct(map);
      } catch { /* brand view simply shows "No Brand" */ }
    })();
  }, [reviews]);

  // ─── actions (optimistic) ───
  const handleApprove = async (id: string) => {
    await fetch(`/api/reviews/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_approved: true }) }).catch(() => {});
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, is_approved: true } : r));
  };
  const handleReject = async (id: string) => {
    await fetch(`/api/reviews/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_approved: false }) }).catch(() => {});
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, is_approved: false } : r));
  };
  const handleReply = async () => {
    if (!replyDialog || !replyText.trim()) return;
    setReplySaving(true);
    await fetch(`/api/reviews/${replyDialog.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ admin_reply: replyText.trim() }) }).catch(() => {});
    setReviews((prev) => prev.map((r) => r.id === replyDialog.id ? { ...r, admin_reply: replyText.trim() } : r));
    setReplyDialog(null); setReplyText(""); setReplySaving(false);
  };
  const handleDelete = async () => {
    if (!deleteDialog) return;
    await fetch(`/api/reviews/${deleteDialog.id}`, { method: "DELETE" }).catch(() => {});
    setReviews((prev) => prev.filter((r) => r.id !== deleteDialog.id));
    setDeleteDialog(null);
  };
  const openReply = (review: ReviewData) => { setReplyDialog(review); setReplyText(review.admin_reply || ""); };

  // ─── derived totals ───
  const pendingReviews = useMemo(() => reviews.filter((r) => !r.is_approved), [reviews]);
  const approvedReviews = useMemo(() => reviews.filter((r) => r.is_approved), [reviews]);
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length).toFixed(1) : "0.0";

  const stats = [
    { key: "total", label: "Total Reviews", value: reviews.length, icon: MessageSquareText, color: "text-charcoal", bg: "bg-pearl", onClick: () => setMode("moderate") },
    { key: "avg", label: "Avg Rating", value: `${avgRating} ★`, icon: Star, color: "text-gold", bg: "bg-gold/10", onClick: undefined },
    { key: "pending", label: "Pending", value: pendingReviews.length, icon: Clock, color: "text-warning", bg: "bg-warning/10", onClick: () => { setMode("moderate"); setModStatus("pending"); } },
    { key: "approved", label: "Approved", value: approvedReviews.length, icon: CheckCircle2, color: "text-success", bg: "bg-success/10", onClick: () => { setMode("moderate"); setModStatus("approved"); } },
  ] as const;

  const modes: { id: Mode; label: string; icon: typeof Star }[] = [
    { id: "moderate", label: "Moderate", icon: MessageSquare },
    { id: "product", label: "By Product", icon: Package },
    { id: "brand", label: "By Brand", icon: Tag },
    { id: "person", label: "By Person", icon: User },
  ];

  // ─── Moderate filters ───
  const [modStatus, setModStatus] = useState<"pending" | "approved" | "all">("pending");
  const [modRating, setModRating] = useState<string>("all");
  const [modWithImages, setModWithImages] = useState(false);
  const [modNeedsReply, setModNeedsReply] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Shared review row (used by every mode)
  // ─────────────────────────────────────────────────────────────────────────
  const ReviewRow = ({ review, index = 0, showProduct = true }: { review: ReviewData; index?: number; showProduct?: boolean }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.04 }}>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className="text-xs">{getInitials(review.customer_name)}</AvatarFallback></Avatar>

            <div className="min-w-0 flex-1">
              {/* header line */}
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-sm font-medium text-charcoal truncate">{review.customer_name}</span>
                <TierBadge tier={review.customer_tier} color={review.customer_tier_color} />
                {review.is_verified_purchase && <Badge variant="success" className="text-[9px] shrink-0">Verified</Badge>}
                <Badge variant={review.is_approved ? "success" : "warning"} className="text-[9px] shrink-0">{review.is_approved ? "Approved" : "Pending"}</Badge>
                <span className="text-[10px] text-charcoal-lighter ml-auto shrink-0">{formatDateShort(review.created_at)}</span>
              </div>

              <div className="flex items-center gap-2 mb-1.5">
                <Stars value={review.rating} size="xs" />
                {showProduct && (
                  <span className="text-[11px] text-charcoal-lighter truncate">
                    on <span className="text-charcoal font-medium">{review.product_name || "Unknown product"}</span>
                  </span>
                )}
              </div>

              {review.title && <h4 className="text-sm font-medium text-charcoal mb-0.5">{review.title}</h4>}
              <p className="text-sm text-charcoal-light leading-relaxed line-clamp-4">{review.comment}</p>

              {review.images && review.images.length > 0 && <div className="mt-2"><ReviewImageGallery images={review.images} /></div>}

              {review.admin_reply && (
                <div className="bg-primary-light rounded-lg p-3 mt-3">
                  <p className="text-[10px] font-medium text-secondary mb-1">ChineXa Reply</p>
                  <p className="text-xs text-charcoal-light">{review.admin_reply}</p>
                </div>
              )}

              {/* actions */}
              {(canApproveReview || canDeleteReview) && (
                <div className="flex items-center gap-2 pt-3 mt-3 border-t border-border/30">
                  {!review.is_approved && canApproveReview && (
                    <AdminButton size="sm" onClick={() => handleApprove(review.id)}><Check className="h-3 w-3 mr-1" /> Approve</AdminButton>
                  )}
                  {review.is_approved && canApproveReview && (
                    <AdminButton variant="outline" size="sm" onClick={() => openReply(review)}>
                      <MessageSquare className="h-3 w-3 mr-1" /> {review.admin_reply ? "Edit Reply" : "Reply"}
                    </AdminButton>
                  )}
                  {(canApproveReview || canDeleteReview) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <AdminButton variant="ghost" size="sm" className="ml-auto px-2"><MoreHorizontal className="h-4 w-4" /></AdminButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!review.is_approved && canApproveReview && (
                          <DropdownMenuItem onClick={() => openReply(review)}>
                            <MessageSquare className="h-3.5 w-3.5 mr-2" /> {review.admin_reply ? "Edit reply" : "Reply"}
                          </DropdownMenuItem>
                        )}
                        {review.is_approved && canApproveReview && (
                          <DropdownMenuItem onClick={() => handleReject(review.id)}>
                            <X className="h-3.5 w-3.5 mr-2" /> Unapprove
                          </DropdownMenuItem>
                        )}
                        {canDeleteReview && (
                          <DropdownMenuItem onClick={() => setDeleteDialog(review)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Grouping helpers (memoised)
  // ─────────────────────────────────────────────────────────────────────────
  const byProduct = useMemo(() => {
    const map = new Map<string, { id: string; name: string; reviews: ReviewData[] }>();
    for (const r of reviews) {
      const key = r.product_id || "unknown";
      if (!map.has(key)) map.set(key, { id: key, name: r.product_name || "Unknown product", reviews: [] });
      map.get(key)!.reviews.push(r);
    }
    return Array.from(map.values()).map((g) => {
      const approved = g.reviews.filter((r) => r.is_approved);
      const avg = approved.length ? approved.reduce((s, r) => s + Number(r.rating), 0) / approved.length : 0;
      return { ...g, avg, approvedCount: approved.length, pendingCount: g.reviews.length - approved.length };
    }).sort((a, b) => b.reviews.length - a.reviews.length);
  }, [reviews]);

  const byBrand = useMemo(() => {
    const map = new Map<string, { name: string; reviews: ReviewData[]; products: Set<string> }>();
    for (const r of reviews) {
      const brand = brandByProduct[r.product_id] || "No Brand";
      if (!map.has(brand)) map.set(brand, { name: brand, reviews: [], products: new Set() });
      const g = map.get(brand)!;
      g.reviews.push(r);
      if (r.product_id) g.products.add(r.product_id);
    }
    return Array.from(map.values()).map((g) => {
      const approved = g.reviews.filter((r) => r.is_approved);
      const avg = approved.length ? approved.reduce((s, r) => s + Number(r.rating), 0) / approved.length : 0;
      return { name: g.name, avg, total: g.reviews.length, approvedCount: approved.length, pendingCount: g.reviews.length - approved.length, productCount: g.products.size };
    }).sort((a, b) => b.total - a.total);
  }, [reviews, brandByProduct]);

  const byPerson = useMemo(() => {
    const registered = new Map<string, { id: string; name: string; tier?: string | null; tierColor?: string | null; reviews: ReviewData[] }>();
    const guests: ReviewData[] = [];
    for (const r of reviews) {
      if (!r.customer_id) { guests.push(r); continue; }
      if (!registered.has(r.customer_id)) registered.set(r.customer_id, { id: r.customer_id, name: r.customer_name, tier: r.customer_tier, tierColor: r.customer_tier_color, reviews: [] });
      registered.get(r.customer_id)!.reviews.push(r);
    }
    const people = Array.from(registered.values()).map((p) => {
      const avg = p.reviews.length ? p.reviews.reduce((s, r) => s + Number(r.rating), 0) / p.reviews.length : 0;
      const pending = p.reviews.filter((r) => !r.is_approved).length;
      const last = p.reviews.reduce((m, r) => r.created_at > m ? r.created_at : m, p.reviews[0]?.created_at || "");
      return { ...p, avg, pending, last };
    }).sort((a, b) => b.reviews.length - a.reviews.length);
    return { people, guests };
  }, [reviews]);

  // ─── loading ───
  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;
  }

  const productMatch = (name: string) => name.toLowerCase().includes(search.trim().toLowerCase());

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Reviews</h1>
          <p className="text-sm text-charcoal-lighter">Moderate, reply, and analyse customer reviews</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.key}
            onClick={s.onClick}
            className={cn("transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]", s.onClick && "cursor-pointer")}>
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", s.bg)}><s.icon className={cn("h-3.5 w-3.5", s.color)} /></div>
              <div>
                <p className="text-base font-bold text-charcoal leading-tight [font-variant-numeric:tabular-nums]">{s.value}</p>
                <p className="text-[9px] text-charcoal-lighter">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {reviews.length === 0 ? (
        <EmptyState icon={Star} title="No reviews yet" description="Customer reviews will appear here when they submit them from product pages." />
      ) : (
        <>
          {/* Mode segmented control */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {modes.map((m) => (
              <button key={m.id}
                onClick={() => { setMode(m.id); setSelectedProduct(null); setSelectedPerson(null); setSearch(""); }}
                className={cn("flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-[0.96]",
                  mode === m.id ? "bg-charcoal !text-white" : "bg-pearl text-charcoal-lighter hover:text-charcoal")}>
                <m.icon className="h-3.5 w-3.5" /> {m.label}
              </button>
            ))}
          </div>

          {/* ══════════════ MODERATE ══════════════ */}
          {mode === "moderate" && (
            <ModerateView
              reviews={reviews}
              pending={pendingReviews}
              approved={approvedReviews}
              status={modStatus} setStatus={setModStatus}
              rating={modRating} setRating={setModRating}
              withImages={modWithImages} setWithImages={setModWithImages}
              needsReply={modNeedsReply} setNeedsReply={setModNeedsReply}
              canApprove={canApproveReview}
              ReviewRow={ReviewRow}
            />
          )}

          {/* ══════════════ BY PRODUCT ══════════════ */}
          {mode === "product" && (
            selectedProduct ? (
              <ProductDetailView
                group={byProduct.find((g) => g.id === selectedProduct)}
                onBack={() => setSelectedProduct(null)}
                ReviewRow={ReviewRow}
              />
            ) : (
              <>
                <SearchBar value={search} onChange={setSearch} placeholder="Search a product…" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {byProduct.filter((g) => productMatch(g.name)).map((g) => (
                    <button key={g.id} onClick={() => setSelectedProduct(g.id)} className="text-left">
                      <Card className="h-full transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-2 mb-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pearl shrink-0"><Package className="h-4 w-4 text-charcoal-lighter" /></div>
                            <p className="text-sm font-medium text-charcoal line-clamp-2 leading-snug">{g.name}</p>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Stars value={g.avg} size="xs" />
                            <span className="text-sm font-bold text-charcoal [font-variant-numeric:tabular-nums]">{g.avg.toFixed(1)}</span>
                            <span className="text-[11px] text-charcoal-lighter">({g.approvedCount})</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="secondary" className="text-[9px]">{g.reviews.length} total</Badge>
                            {g.pendingCount > 0 && <Badge variant="warning" className="text-[9px]">{g.pendingCount} pending</Badge>}
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  ))}
                </div>
                {byProduct.filter((g) => productMatch(g.name)).length === 0 && (
                  <EmptyState icon={Search} title="No products found" description="No reviewed product matches your search." />
                )}
              </>
            )
          )}

          {/* ══════════════ BY BRAND ══════════════ */}
          {mode === "brand" && (
            <>
              <SearchBar value={search} onChange={setSearch} placeholder="Search a brand…" />
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/20 text-left">
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Brand</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Avg Rating</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden sm:table-cell">Reviews</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden md:table-cell">Products</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byBrand.filter((b) => productMatch(b.name)).map((b) => (
                        <tr key={b.name} className="border-b border-border/10 last:border-0">
                          <td className="px-4 py-3 font-medium text-charcoal">{b.name}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Stars value={b.avg} size="xs" />
                              <span className="font-bold text-charcoal [font-variant-numeric:tabular-nums]">{b.avg.toFixed(1)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-charcoal-light hidden sm:table-cell [font-variant-numeric:tabular-nums]">{b.total}</td>
                          <td className="px-4 py-3 text-charcoal-light hidden md:table-cell [font-variant-numeric:tabular-nums]">{b.productCount}</td>
                          <td className="px-4 py-3">
                            {b.pendingCount > 0 ? <Badge variant="warning" className="text-[9px]">{b.pendingCount}</Badge> : <span className="text-charcoal-lighter">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {byBrand.filter((b) => productMatch(b.name)).length === 0 && (
                  <EmptyState icon={Search} title="No brands found" description="No brand matches your search." />
                )}
              </Card>
            </>
          )}

          {/* ══════════════ BY PERSON ══════════════ */}
          {mode === "person" && (
            selectedPerson ? (
              <PersonDetailView
                person={byPerson.people.find((p) => p.id === selectedPerson) || (selectedPerson === "__guests__" ? { id: "__guests__", name: "Guests", reviews: byPerson.guests } as { id: string; name: string; reviews: ReviewData[] } : undefined)}
                onBack={() => setSelectedPerson(null)}
                ReviewRow={ReviewRow}
              />
            ) : (
              <>
                <SearchBar value={search} onChange={setSearch} placeholder="Search a customer…" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {byPerson.people.filter((p) => productMatch(p.name)).map((p) => (
                    <button key={p.id} onClick={() => setSelectedPerson(p.id)} className="text-left">
                      <Card className="h-full transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2.5 mb-2">
                            <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className="text-xs">{getInitials(p.name)}</AvatarFallback></Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5"><span className="text-sm font-medium text-charcoal truncate">{p.name}</span><TierBadge tier={p.tier} color={p.tierColor} /></div>
                              <p className="text-[10px] text-charcoal-lighter">Last: {formatDateShort(p.last)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Stars value={p.avg} size="xs" />
                            <span className="text-xs font-bold text-charcoal [font-variant-numeric:tabular-nums]">{p.avg.toFixed(1)} avg</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="secondary" className="text-[9px]">{p.reviews.length} reviews</Badge>
                            {p.pending > 0 && <Badge variant="warning" className="text-[9px]">{p.pending} pending</Badge>}
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  ))}

                  {/* Guests bucket — anonymous reviews have no stable customer_id */}
                  {byPerson.guests.length > 0 && !search.trim() && (
                    <button onClick={() => setSelectedPerson("__guests__")} className="text-left">
                      <Card className="h-full border-dashed transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2.5 mb-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pearl shrink-0"><User className="h-4 w-4 text-charcoal-lighter" /></div>
                            <div><span className="text-sm font-medium text-charcoal">Guests</span><p className="text-[10px] text-charcoal-lighter">Anonymous reviewers</p></div>
                          </div>
                          <Badge variant="secondary" className="text-[9px]">{byPerson.guests.length} reviews</Badge>
                        </CardContent>
                      </Card>
                    </button>
                  )}
                </div>
                {byPerson.people.filter((p) => productMatch(p.name)).length === 0 && byPerson.guests.length === 0 && (
                  <EmptyState icon={Search} title="No customers found" description="No customer matches your search." />
                )}
              </>
            )
          )}
        </>
      )}

      {/* Reply Dialog */}
      <Dialog open={!!replyDialog} onOpenChange={(open) => { if (!open) { setReplyDialog(null); setReplyText(""); } }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Reply to Review</DialogTitle>
            <DialogDescription>Your reply will be visible to all customers on the product page</DialogDescription>
          </DialogHeader>
          {replyDialog && (
            <div className="p-3 rounded-lg bg-pearl/60 mb-2">
              <div className="mb-1"><Stars value={replyDialog.rating} size="xs" /></div>
              <p className="text-xs text-charcoal-light line-clamp-2">{replyDialog.comment}</p>
              <p className="text-[10px] text-charcoal-lighter mt-1">— {replyDialog.customer_name}</p>
            </div>
          )}
          <Textarea placeholder="Write your reply..." className="min-h-[100px]" value={replyText} onChange={(e) => setReplyText(e.target.value)} required />
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => { setReplyDialog(null); setReplyText(""); }}>Cancel</AdminButton>
            <AdminButton onClick={handleReply} disabled={replySaving || !replyText.trim()}>
              {replySaving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Post Reply
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader><DialogTitle>Delete Review</DialogTitle><DialogDescription>This action cannot be undone.</DialogDescription></DialogHeader>
          {deleteDialog && <p className="text-sm text-charcoal-light">Review by <strong>{deleteDialog.customer_name}</strong> on <strong>{deleteDialog.product_name}</strong></p>}
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /> Delete</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} icon={<Search className="h-4 w-4" />} />
  );
}

type RowRenderer = (args: { review: ReviewData; index?: number; showProduct?: boolean }) => React.ReactElement;

function ModerateView({
  reviews, pending, approved, status, setStatus, rating, setRating,
  withImages, setWithImages, needsReply, setNeedsReply, canApprove, ReviewRow,
}: {
  reviews: ReviewData[]; pending: ReviewData[]; approved: ReviewData[];
  status: "pending" | "approved" | "all"; setStatus: (s: "pending" | "approved" | "all") => void;
  rating: string; setRating: (r: string) => void;
  withImages: boolean; setWithImages: (b: boolean) => void;
  needsReply: boolean; setNeedsReply: (b: boolean) => void;
  canApprove: boolean;
  ReviewRow: RowRenderer;
}) {
  const base = status === "pending" ? pending : status === "approved" ? approved : reviews;
  const filtered = base.filter((r) => {
    if (rating !== "all" && Math.round(r.rating) !== Number(rating)) return false;
    if (withImages && !(r.images && r.images.length > 0)) return false;
    if (needsReply && r.admin_reply) return false;
    return true;
  });

  const statusTabs: { id: "pending" | "approved" | "all"; label: string; count: number }[] = [
    { id: "pending", label: "Pending", count: pending.length },
    { id: "approved", label: "Approved", count: approved.length },
    { id: "all", label: "All", count: reviews.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {statusTabs.map((t) => (
            <button key={t.id} onClick={() => setStatus(t.id)}
              className={cn("flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-[0.96]",
                status === t.id ? "bg-charcoal !text-white" : "bg-pearl text-charcoal-lighter hover:text-charcoal")}>
              {t.label}
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", status === t.id ? "bg-white/20" : "bg-white")}>{t.count}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <Select value={rating} onValueChange={setRating}>
            <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ratings</SelectItem>
              <SelectItem value="5">5 ★</SelectItem>
              <SelectItem value="4">4 ★</SelectItem>
              <SelectItem value="3">3 ★</SelectItem>
              <SelectItem value="2">2 ★</SelectItem>
              <SelectItem value="1">1 ★</SelectItem>
            </SelectContent>
          </Select>
          <button onClick={() => setWithImages(!withImages)}
            className={cn("px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-[0.96]",
              withImages ? "bg-charcoal !text-white" : "bg-pearl text-charcoal-lighter hover:text-charcoal")}>With images</button>
          <button onClick={() => setNeedsReply(!needsReply)}
            className={cn("px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-[0.96]",
              needsReply ? "bg-charcoal !text-white" : "bg-pearl text-charcoal-lighter hover:text-charcoal")}>Needs reply</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={status === "pending" ? "Queue clear" : "Nothing here"} description={status === "pending" ? "No pending reviews match your filters." : "No reviews match your filters."} />
      ) : (
        <div className="space-y-3">
          {filtered.map((r, i) => <ReviewRow key={r.id} review={r} index={i} />)}
        </div>
      )}
      {!canApprove && filtered.length > 0 && (
        <p className="text-[11px] text-charcoal-lighter text-center">You have view-only access to reviews.</p>
      )}
    </div>
  );
}

function ProductDetailView({ group, onBack, ReviewRow }: {
  group: { id: string; name: string; reviews: ReviewData[]; avg: number; approvedCount: number; pendingCount: number } | undefined;
  onBack: () => void; ReviewRow: RowRenderer;
}) {
  if (!group) { return <EmptyState icon={Package} title="Product not found" description="This product's reviews are no longer available." />; }
  const counts = [0, 0, 0, 0, 0];
  for (const r of group.reviews.filter((r) => r.is_approved)) counts[Math.round(r.rating) - 1]++;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-charcoal-lighter hover:text-charcoal"><ChevronLeft className="h-3.5 w-3.5" /> Back to products</button>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="sm:w-48 shrink-0">
              <h3 className="font-heading text-lg font-semibold text-charcoal mb-2 leading-snug">{group.name}</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-charcoal [font-variant-numeric:tabular-nums]">{group.avg.toFixed(1)}</span>
                <Stars value={group.avg} />
              </div>
              <p className="text-[11px] text-charcoal-lighter mt-1">{group.approvedCount} approved · {group.pendingCount} pending</p>
            </div>
            <div className="flex-1 max-w-sm"><RatingHistogram counts={counts} total={group.approvedCount} /></div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {group.reviews.map((r, i) => <ReviewRow key={r.id} review={r} index={i} showProduct={false} />)}
      </div>
    </div>
  );
}

function PersonDetailView({ person, onBack, ReviewRow }: {
  person: { id: string; name: string; reviews: ReviewData[] } | undefined;
  onBack: () => void; ReviewRow: RowRenderer;
}) {
  if (!person) { return <EmptyState icon={User} title="Customer not found" description="This customer's reviews are no longer available." />; }
  const avg = person.reviews.length ? person.reviews.reduce((s, r) => s + Number(r.rating), 0) / person.reviews.length : 0;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-charcoal-lighter hover:text-charcoal"><ChevronLeft className="h-3.5 w-3.5" /> Back to customers</button>

      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Avatar className="h-11 w-11 shrink-0"><AvatarFallback>{getInitials(person.name)}</AvatarFallback></Avatar>
          <div>
            <h3 className="text-base font-semibold text-charcoal">{person.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Stars value={avg} size="xs" />
              <span className="text-xs text-charcoal-lighter [font-variant-numeric:tabular-nums]">{avg.toFixed(1)} avg · {person.reviews.length} reviews</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {person.reviews.map((r, i) => <ReviewRow key={r.id} review={r} index={i} />)}
      </div>
    </div>
  );
}
