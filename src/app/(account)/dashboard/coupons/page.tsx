"use client";

import { useState, useEffect } from "react";
import { Tag, Gift, Loader2, Globe, Users, FolderTree, ShoppingCart, Copy, Check, Calendar, Wallet, Award } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth.store";
import { formatCurrency, formatDateShort, cn } from "@/lib/utils";

const applicabilityConfig: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  store: { label: "Store-wide — applies to any purchase", icon: Globe, color: "bg-blue-50 text-blue-600" },
  products: { label: "Selected products only", icon: ShoppingCart, color: "bg-pink-50 text-pink-600" },
  categories: { label: "Selected categories only", icon: FolderTree, color: "bg-emerald-50 text-emerald-600" },
  subcategories: { label: "Selected subcategories only", icon: FolderTree, color: "bg-violet-50 text-violet-600" },
  brands: { label: "Selected brands only", icon: Award, color: "bg-cyan-50 text-cyan-600" },
  tiers: { label: "Your membership tier", icon: Users, color: "bg-rose-50 text-rose-600" },
  customers: { label: "Just for you", icon: Users, color: "bg-amber-50 text-amber-600" },
};

interface CustomerCoupon {
  id: string; coupon_id: string; coupon_code: string; coupon_description: string;
  discount_type: "percentage" | "fixed"; discount_value: number;
  min_order_amount: number | null; max_discount_amount: number | null;
  usage_limit: number | null; per_customer_limit: number | null; used_count: number;
  valid_from: string | null; valid_until: string | null; coupon_active: boolean;
  applicability: string; applicable_names?: string[];
  is_used: boolean;
}

interface CustomerOffer {
  id: string; title: string; description?: string; discount: string;
  discount_type: "percentage" | "fixed"; discount_value: number;
  max_discount_amount: number | null; start_date?: string; end_date?: string;
  applicability: string; applicable_names?: string[];
}

type SelectedItem = { kind: "coupon"; data: CustomerCoupon } | { kind: "offer"; data: CustomerOffer };

function isExpired(validUntil: string | null | undefined): boolean {
  return !!validUntil && new Date(validUntil) < new Date();
}

export default function CouponsOffersPage() {
  const storeUser = useAuthStore((s) => s.user);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const user = mounted ? storeUser : null;

  const [coupons, setCoupons] = useState<CustomerCoupon[]>([]);
  const [offers, setOffers] = useState<CustomerOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [copiedCode, setCopiedCode] = useState("");

  useEffect(() => {
    if (!mounted) return;
    if (!user?.id) { setLoading(false); return; }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetch(`/api/customers/${user.id}/coupons`).then((r) => r.json()).catch(() => []),
      fetch(`/api/customers/${user.id}/offers`).then((r) => r.json()).catch(() => []),
    ]).then(([couponData, offerData]) => {
      if (cancelled) return;
      setCoupons(Array.isArray(couponData) ? couponData : []);
      setOffers(Array.isArray(offerData) ? offerData : []);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [mounted, user?.id]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(""), 1500);
    });
  };

  const discountLabel = (type: string, value: number) => (type === "fixed" ? `${formatCurrency(value)} OFF` : `${value}% OFF`);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-charcoal-lighter" />
      </div>
    );
  }

  const activeCoupons = coupons.filter((c) => !c.is_used && !isExpired(c.valid_until));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-charcoal">Offers & Coupons</h2>
        <p className="text-xs text-charcoal-lighter mt-0.5">Tap any card to see the full terms before you shop</p>
      </div>

      {/* My Coupons */}
      <div>
        <h3 className="text-sm font-semibold text-charcoal mb-3 flex items-center gap-1.5"><Wallet className="h-4 w-4 text-secondary" /> My Coupons</h3>
        {activeCoupons.length === 0 ? (
          <EmptyState icon={Tag} title="No coupons yet" description="Coupons assigned to you or your membership tier will show up here." />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {activeCoupons.map((c) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelected({ kind: "coupon", data: c })}
                className="text-left p-4 rounded-2xl border border-dashed border-secondary/40 bg-secondary/5 hover:bg-secondary/10 hover:border-secondary transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-heading text-lg font-semibold text-secondary">{discountLabel(c.discount_type, c.discount_value)}</p>
                    <p className="text-xs text-charcoal-lighter mt-0.5 line-clamp-2">{c.coupon_description || "No description"}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">{c.coupon_code}</Badge>
                </div>
                {c.valid_until && (
                  <p className="text-[10px] text-charcoal-lighter mt-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> Valid until {formatDateShort(c.valid_until)}</p>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Active Offers */}
      <div>
        <h3 className="text-sm font-semibold text-charcoal mb-3 flex items-center gap-1.5"><Gift className="h-4 w-4 text-secondary" /> Offers For You</h3>
        {offers.length === 0 ? (
          <EmptyState icon={Gift} title="No active offers" description="Automatic discounts you qualify for will appear here — no code needed, they apply at checkout." />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {offers.map((o) => (
              <motion.button
                key={o.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelected({ kind: "offer", data: o })}
                className="text-left p-4 rounded-2xl border border-border bg-white hover:border-secondary hover:shadow-card transition-all"
              >
                <p className="font-heading text-lg font-semibold text-charcoal">{o.discount || discountLabel(o.discount_type, o.discount_value)}</p>
                <p className="text-sm font-medium text-charcoal mt-1">{o.title}</p>
                {o.description && <p className="text-xs text-charcoal-lighter mt-0.5 line-clamp-2">{o.description}</p>}
                {o.end_date && (
                  <p className="text-[10px] text-charcoal-lighter mt-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> Ends {formatDateShort(o.end_date)}</p>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.kind === "coupon" ? <Tag className="h-5 w-5 text-secondary" /> : <Gift className="h-5 w-5 text-secondary" />}
                  {selected.kind === "coupon" ? discountLabel(selected.data.discount_type, selected.data.discount_value) : selected.data.title}
                </DialogTitle>
                <DialogDescription>
                  {selected.kind === "coupon" ? (selected.data.coupon_description || "Coupon details") : (selected.data.description || "Offer details")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                {selected.kind === "coupon" && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-pearl/50">
                    <div>
                      <p className="text-[10px] text-charcoal-lighter">Coupon Code</p>
                      <p className="font-mono font-semibold text-charcoal">{selected.data.coupon_code}</p>
                    </div>
                    <button
                      onClick={() => handleCopyCode(selected.data.coupon_code)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary !text-white text-xs font-semibold hover:bg-secondary-dark transition-all"
                    >
                      {copiedCode === selected.data.coupon_code ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedCode === selected.data.coupon_code ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-charcoal-lighter">Discount</span>
                    <span className="font-medium text-charcoal">
                      {selected.data.discount_type === "percentage" ? `${selected.data.discount_value}% off` : `${formatCurrency(selected.data.discount_value)} off`}
                    </span>
                  </div>

                  {selected.data.max_discount_amount != null && (
                    <div className="flex justify-between">
                      <span className="text-charcoal-lighter">Max Discount</span>
                      <span className="font-medium text-charcoal">{formatCurrency(selected.data.max_discount_amount)}</span>
                    </div>
                  )}

                  {selected.kind === "coupon" && selected.data.min_order_amount != null && (
                    <div className="flex justify-between">
                      <span className="text-charcoal-lighter">Minimum Order</span>
                      <span className="font-medium text-charcoal">{formatCurrency(selected.data.min_order_amount)}</span>
                    </div>
                  )}

                  {selected.kind === "coupon" && selected.data.per_customer_limit != null && (
                    <div className="flex justify-between">
                      <span className="text-charcoal-lighter">Uses Per Customer</span>
                      <span className="font-medium text-charcoal">{selected.data.per_customer_limit}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-charcoal-lighter">Valid Until</span>
                    <span className="font-medium text-charcoal">
                      {selected.kind === "coupon"
                        ? (selected.data.valid_until ? formatDateShort(selected.data.valid_until) : "No expiry")
                        : (selected.data.end_date ? formatDateShort(selected.data.end_date) : "No expiry")}
                    </span>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-medium text-charcoal mb-2">Applicability</p>
                  {(() => {
                    const cfg = applicabilityConfig[selected.data.applicability] || applicabilityConfig.store;
                    const Icon = cfg.icon;
                    return (
                      <div className={cn("flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium", cfg.color)}>
                        <Icon className="h-3.5 w-3.5 shrink-0" /> {cfg.label}
                      </div>
                    );
                  })()}
                  {!!selected.data.applicable_names?.length && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selected.data.applicable_names.map((name) => (
                        <Badge key={name} variant="outline" className="text-[10px]">{name}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {selected.kind === "offer" && (
                  <p className="text-[11px] text-charcoal-lighter bg-blue-50 text-blue-700 p-2.5 rounded-xl">
                    This offer applies automatically at checkout — no code needed.
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
