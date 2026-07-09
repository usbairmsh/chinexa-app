"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Crown, Check, Star, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";
import { resolveTierColorStyle } from "@/lib/tier-color";
import type { MembershipTier } from "@/types/membership";

export default function MembershipBenefitsPage() {
  const storeUser = useAuthStore((s) => s.user);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const user = mounted ? storeUser : null;

  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [currentTierId, setCurrentTierId] = useState<string | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [nextTierAt, setNextTierAt] = useState(0);
  const [pointsToNext, setPointsToNext] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetch("/api/membership/tiers").then((r) => r.json()),
      user?.id ? fetch(`/api/customers/${user.id}/points`).then((r) => r.json()) : Promise.resolve(null),
    ])
      .then(([tiersData, pointsData]) => {
        if (cancelled) return;
        const activeTiers: MembershipTier[] = Array.isArray(tiersData) ? tiersData.filter((t) => t.is_active) : [];
        setTiers(activeTiers);

        const currentId = pointsData?.tier?.id ?? null;
        setCurrentTierId(currentId);
        setExpandedId(currentId ?? activeTiers[0]?.id ?? null);
        setTotalPoints(pointsData?.total_points || 0);
        if (pointsData?.next_tier) {
          setNextTierAt(pointsData.next_tier.min_points);
          setPointsToNext(pointsData.points_to_next_tier);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [mounted, user?.id]);

  const currentTier = tiers.find((t) => t.id === currentTierId) || null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="font-heading text-xl font-semibold text-charcoal">Membership Benefits</h2>
          <p className="text-xs text-charcoal-lighter">See every tier and what it unlocks</p>
        </div>
      </div>

      {/* Current membership summary */}
      {mounted && user?.id && (
        <Card className="bg-gradient-to-r from-secondary/10 via-primary-light to-coral-light border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-charcoal-lighter mb-1">Your current membership</p>
                <div className="flex items-center gap-2">
                  {(() => {
                    const summaryTierColor = resolveTierColorStyle(currentTier?.color);
                    return (
                      <Badge className={cn("text-[10px]", summaryTierColor.className)} style={summaryTierColor.style}>
                        {currentTier?.name || "—"} Member
                      </Badge>
                    );
                  })()}
                  {currentTier?.badge_enabled && currentTier.badge_color && (
                    <VerifiedBadge color={currentTier.badge_color} opacity={currentTier.badge_opacity} size={17} tooltip={currentTier.badge_name} />
                  )}
                </div>
              </div>
              <p className="font-heading text-2xl font-bold text-charcoal flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-gold" /> {totalPoints.toLocaleString()} <span className="text-sm font-normal text-charcoal-lighter">points</span>
              </p>
            </div>
            {nextTierAt > 0 && (
              <div className="max-w-xs mt-4">
                <div className="flex items-center justify-between text-[10px] text-charcoal-lighter mb-1">
                  <span>{totalPoints.toLocaleString()} pts</span>
                  <span>Next tier at {nextTierAt.toLocaleString()}</span>
                </div>
                <Progress value={Math.min((totalPoints / nextTierAt) * 100, 100)} />
                <p className="text-[9px] text-charcoal-lighter mt-1">{pointsToNext} points to go</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* All tiers */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-charcoal mb-3">Membership Levels</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-charcoal-lighter" />
            </div>
          ) : tiers.length === 0 ? (
            <EmptyState icon={Crown} title="No membership tiers yet" description="Membership levels and their perks will show up here once configured." />
          ) : (
            <div className="space-y-2">
              {tiers.map((tier, i) => {
                const isCurrent = tier.id === currentTierId;
                const isExpanded = tier.id === expandedId;
                const rowTierColor = resolveTierColorStyle(tier.color);
                return (
                  <motion.div
                    key={tier.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <div
                      className={cn(
                        "rounded-xl border transition-colors cursor-pointer",
                        isCurrent ? "border-secondary/40 bg-secondary/5" : "border-border/20 hover:bg-pearl/50"
                      )}
                      onClick={() => setExpandedId(isExpanded ? null : tier.id)}
                    >
                      <div className="flex items-center gap-3 p-4">
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", rowTierColor.className)} style={rowTierColor.style}>
                          <Crown className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-charcoal">{tier.name}</p>
                            {tier.badge_enabled && tier.badge_color && (
                              <VerifiedBadge color={tier.badge_color} opacity={tier.badge_opacity} size={15} tooltip={tier.badge_name} />
                            )}
                            {isCurrent && (
                              <Badge className="text-[9px] bg-secondary/15 text-secondary">Your tier</Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-charcoal-lighter mt-0.5">
                            {tier.min_points.toLocaleString()}
                            {tier.max_points > 0 ? ` – ${tier.max_points.toLocaleString()}` : "+"} points
                            {tier.points_multiplier !== 1 ? ` · ${tier.points_multiplier}x points` : ""}
                          </p>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4">
                          {tier.benefits && tier.benefits.length > 0 ? (
                            <ul className="space-y-1.5 pl-1">
                              {tier.benefits.map((benefit, bi) => (
                                <li key={bi} className="flex items-start gap-2 text-xs text-charcoal-light">
                                  {isCurrent ? (
                                    <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                                  ) : (
                                    <Star className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
                                  )}
                                  <span>{benefit}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-charcoal-lighter italic">No specific perks listed for this tier.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
