"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Star, ArrowLeft, Loader2, TrendingUp, TrendingDown, Gift, ShoppingBag, RotateCcw, Settings, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

interface PointsEntry {
  id: string;
  points: number;
  type: "purchase" | "bonus" | "redemption" | "admin_adjustment" | "coupon_reward" | "refund";
  description: string;
  created_at: string;
}

const typeConfig: Record<string, { label: string; icon: typeof Star; color: string }> = {
  purchase: { label: "Purchase", icon: ShoppingBag, color: "text-secondary bg-secondary/10" },
  bonus: { label: "Bonus", icon: Gift, color: "text-gold bg-gold/10" },
  redemption: { label: "Redeemed", icon: RotateCcw, color: "text-destructive bg-destructive/10" },
  admin_adjustment: { label: "Adjustment", icon: Settings, color: "text-blue-500 bg-blue-50" },
  coupon_reward: { label: "Coupon Reward", icon: Tag, color: "text-violet-500 bg-violet-50" },
  refund: { label: "Refund Reversal", icon: RotateCcw, color: "text-destructive bg-destructive/10" },
};

function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(date));
}

export default function PointsHistoryPage() {
  const storeUser = useAuthStore((s) => s.user);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const user = mounted ? storeUser : null;

  const [totalPoints, setTotalPoints] = useState(0);
  const [tierName, setTierName] = useState("Bronze");
  const [tierColor, setTierColor] = useState("bg-orange-100 text-orange-700");
  const [nextTierName, setNextTierName] = useState<string | null>(null);
  const [nextTierAt, setNextTierAt] = useState(0);
  const [pointsToNext, setPointsToNext] = useState(0);
  const [history, setHistory] = useState<PointsEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mounted) return;
    if (!user?.id) { setLoading(false); return; }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/customers/${user.id}/points`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data || data.error) return;
        setTotalPoints(data.total_points || 0);
        if (data.tier) { setTierName(data.tier.name); setTierColor(data.tier.color || "bg-orange-100 text-orange-700"); }
        if (data.next_tier) {
          setNextTierName(data.next_tier.name);
          setNextTierAt(data.next_tier.min_points);
          setPointsToNext(data.points_to_next_tier);
        }
        setHistory(Array.isArray(data.history) ? data.history : []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [mounted, user?.id]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="font-heading text-xl font-semibold text-charcoal">Loyalty Points</h2>
          <p className="text-xs text-charcoal-lighter">Track every point you've earned or used</p>
        </div>
      </div>

      {/* Summary */}
      <Card className="bg-gradient-to-r from-secondary/10 via-primary-light to-coral-light border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <Badge className={cn("text-[10px] mb-2", tierColor)}>{tierName} Member</Badge>
              <p className="font-heading text-3xl font-bold text-charcoal flex items-center gap-2">
                <Star className="h-6 w-6 text-gold" /> {totalPoints.toLocaleString()} <span className="text-sm font-normal text-charcoal-lighter">points</span>
              </p>
            </div>
          </div>
          {nextTierAt > 0 && (
            <div className="max-w-xs mt-4">
              <div className="flex items-center justify-between text-[10px] text-charcoal-lighter mb-1">
                <span>{totalPoints.toLocaleString()} pts</span>
                <span>{nextTierName} at {nextTierAt.toLocaleString()}</span>
              </div>
              <Progress value={Math.min((totalPoints / nextTierAt) * 100, 100)} />
              <p className="text-[9px] text-charcoal-lighter mt-1">{pointsToNext} points to go</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-charcoal mb-3">Points History</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-charcoal-lighter" />
            </div>
          ) : history.length === 0 ? (
            <EmptyState icon={Star} title="No points activity yet" description="Points you earn from orders and bonuses will show up here." />
          ) : (
            <div className="space-y-1">
              {history.map((entry) => {
                const config = typeConfig[entry.type] || typeConfig.bonus;
                const Icon = config.icon;
                const isPositive = entry.points > 0;
                return (
                  <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-pearl/50 transition-colors">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-charcoal truncate">{entry.description || config.label}</p>
                        <Badge variant="outline" className="text-[9px] shrink-0">{config.label}</Badge>
                      </div>
                      <p className="text-[10px] text-charcoal-lighter">{formatDateTime(entry.created_at)}</p>
                    </div>
                    <div className={cn("flex items-center gap-1 text-sm font-semibold shrink-0", isPositive ? "text-success" : "text-destructive")}>
                      {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {isPositive ? "+" : ""}{entry.points.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
