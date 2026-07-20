"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Crown, Check, Star, Sparkles } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";
import { resolveTierColorStyle } from "@/lib/tier-color";
import type { MembershipTier } from "@/types/membership";

/**
 * Public membership benefits page — same tier/benefit data and checkmark
 * (own tier) vs. gold star (other tiers) treatment as the signed-in dashboard
 * version, but reachable by guests too (unlike /dashboard/membership, which
 * the account layout redirects to /login). This is what the footer's
 * "Membership Benefits" link points to.
 */
export default function MembershipBenefitsPage() {
  const storeUser = useAuthStore((s) => s.user);
  const storeAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const user = mounted ? storeUser : null;
  const isAuthenticated = mounted && storeAuthenticated;

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
      isAuthenticated && user?.id ? fetch(`/api/customers/${user.id}/points`).then((r) => r.json()) : Promise.resolve(null),
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
  }, [mounted, isAuthenticated, user?.id]);

  const currentTier = tiers.find((t) => t.id === currentTierId) || null;

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-hero-gradient py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={[{ label: "Membership Benefits" }]} />
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-semibold text-charcoal mt-4 flex items-center gap-3">
            <Crown className="h-8 w-8 sm:h-10 sm:w-10 text-gold" /> Membership Benefits
          </h1>
          <p className="text-charcoal-lighter mt-3 max-w-lg">
            Earn points with every purchase and unlock better perks as you climb the tiers.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
        {/* Current membership summary — signed-in customers only */}
        {isAuthenticated && user?.id && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-2xl bg-gradient-to-r from-secondary/10 via-primary-light to-coral-light border-0 shadow-card">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-xs text-charcoal-lighter mb-1.5">Your current membership</p>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const summaryTierColor = resolveTierColorStyle(currentTier?.color);
                        return (
                          <Badge className={cn("text-xs", summaryTierColor.className)} style={summaryTierColor.style}>
                            {currentTier?.name || "—"} Member
                          </Badge>
                        );
                      })()}
                      {currentTier?.badge_enabled && currentTier.badge_color && (
                        <VerifiedBadge color={currentTier.badge_color} opacity={currentTier.badge_opacity} size={17} tooltip={currentTier.badge_name} />
                      )}
                    </div>
                  </div>
                  <p className="font-heading text-2xl sm:text-3xl font-bold text-charcoal flex items-center gap-2">
                    <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-gold" /> {totalPoints.toLocaleString()} <span className="text-sm font-normal text-charcoal-lighter">points</span>
                  </p>
                </div>
                {nextTierAt > 0 && (
                  <div className="max-w-xs mt-5">
                    <div className="flex items-center justify-between text-xs text-charcoal-lighter mb-1.5">
                      <span>{totalPoints.toLocaleString()} pts</span>
                      <span>Next tier at {nextTierAt.toLocaleString()}</span>
                    </div>
                    <Progress value={Math.min((totalPoints / nextTierAt) * 100, 100)} />
                    <p className="text-xs text-charcoal-lighter mt-1.5">{pointsToNext} points to go</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Guests — nudge to create an account instead of a personal summary */}
        {!isAuthenticated && (
          <Card className="rounded-2xl bg-gradient-to-r from-secondary/10 via-primary-light to-coral-light border-0 shadow-card">
            <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="font-heading text-lg sm:text-xl font-semibold text-charcoal">Start earning points today</p>
                <p className="text-sm text-charcoal-lighter mt-1">Create a free account to track your points and unlock every tier below.</p>
              </div>
              <Link href="/register"><Button variant="secondary" className="!text-white shrink-0">Create Account</Button></Link>
            </CardContent>
          </Card>
        )}

        {/* All tiers */}
        <Card className="rounded-2xl shadow-card">
          <CardContent className="p-6 sm:p-8">
            <h3 className="font-heading text-lg sm:text-xl font-semibold text-charcoal mb-5">Membership Levels</h3>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-charcoal-lighter" />
              </div>
            ) : tiers.length === 0 ? (
              <EmptyState icon={Crown} title="No membership tiers yet" description="Membership levels and their perks will show up here once configured." />
            ) : (
              <div className="space-y-3">
                {tiers.map((tier, i) => {
                  const isCurrent = isAuthenticated && tier.id === currentTierId;
                  const isExpanded = tier.id === expandedId;
                  const rowTierColor = resolveTierColorStyle(tier.color);
                  return (
                    <motion.div
                      key={tier.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div
                        className={cn(
                          "rounded-2xl border transition-colors cursor-pointer",
                          isCurrent ? "border-secondary/40 bg-secondary/5 shadow-card" : "border-border/20 hover:bg-pearl/50"
                        )}
                        onClick={() => setExpandedId(isExpanded ? null : tier.id)}
                      >
                        <div className="flex items-center gap-4 p-5">
                          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl shrink-0", rowTierColor.className)} style={rowTierColor.style}>
                            {tier.badge_enabled && tier.badge_color ? (
                              <VerifiedBadge color={tier.badge_color} opacity={tier.badge_opacity} size={24} tooltip={tier.badge_name} />
                            ) : (
                              <Crown className="h-5 w-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-heading text-base font-semibold text-charcoal">{tier.name}</p>
                              {isCurrent && (
                                <Badge className="text-[10px] bg-secondary/15 text-secondary">Your tier</Badge>
                              )}
                            </div>
                            <p className="text-xs text-charcoal-lighter mt-1">
                              {tier.min_points.toLocaleString()}
                              {tier.max_points > 0 ? ` – ${tier.max_points.toLocaleString()}` : "+"} points
                              {tier.points_multiplier !== 1 ? ` · ${tier.points_multiplier}x points` : ""}
                            </p>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-5 pb-5">
                            {tier.benefits && tier.benefits.length > 0 ? (
                              <ul className="space-y-2 pl-1">
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
    </div>
  );
}
