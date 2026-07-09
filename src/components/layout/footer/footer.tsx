"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Crown, Check, Star } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FOOTER_LINKS } from "@/data/constants/navigation";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { getPlatform, SocialIconButton } from "@/lib/social-platforms";
import { useChatStore } from "@/stores/chat.store";
import { useAuthStore } from "@/stores/auth.store";
import { resolveTierColorStyle } from "@/lib/tier-color";
import { cn } from "@/lib/utils";
import type { MembershipTier } from "@/types/membership";

/**
 * Membership tier teaser — same tier list + benefits as the dashboard's
 * Membership Benefits page, so guests can see what joining unlocks and
 * registered customers see their own tier highlighted the same way. Renders
 * nothing until tiers actually load (never flashes a placeholder).
 */
function FooterMembershipBenefits() {
  const storeUser = useAuthStore((s) => s.user);
  const storeAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isAuthenticated = mounted && storeAuthenticated;
  const userId = mounted ? storeUser?.id : undefined;

  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [currentTierId, setCurrentTierId] = useState<string | null>(null);

  useEffect(() => {
    if (!mounted) return;
    Promise.all([
      fetch("/api/membership/tiers").then((r) => r.json()),
      userId ? fetch(`/api/customers/${userId}/points`).then((r) => r.json()) : Promise.resolve(null),
    ])
      .then(([tiersData, pointsData]) => {
        if (Array.isArray(tiersData)) setTiers(tiersData.filter((t: MembershipTier) => t.is_active));
        setCurrentTierId(pointsData?.tier?.id ?? null);
      })
      .catch(() => {});
  }, [mounted, userId]);

  if (tiers.length === 0) return null;

  return (
    <div className="col-span-2 md:col-span-4">
      <h4 className="font-heading text-sm font-semibold text-charcoal mb-4 tracking-wide flex items-center gap-1.5">
        <Crown className="h-4 w-4 text-gold" /> Membership Benefits
      </h4>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiers.map((tier) => {
          const isCurrent = isAuthenticated && tier.id === currentTierId;
          const tierColor = resolveTierColorStyle(tier.color);
          return (
            <div key={tier.id} className={cn("rounded-xl border p-3 bg-white/60", isCurrent ? "border-secondary/40" : "border-border/20")}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Badge className={cn("text-[9px]", tierColor.className)} style={tierColor.style}>{tier.name}</Badge>
                {isCurrent && <Badge className="text-[9px] bg-secondary/15 text-secondary">Your tier</Badge>}
              </div>
              {tier.benefits && tier.benefits.length > 0 ? (
                <ul className="space-y-1">
                  {tier.benefits.slice(0, 3).map((benefit, bi) => (
                    <li key={bi} className="flex items-start gap-1.5 text-[11px] text-charcoal-lighter">
                      {isCurrent ? (
                        <Check className="h-3 w-3 text-success shrink-0 mt-0.5" />
                      ) : (
                        <Star className="h-3 w-3 text-gold shrink-0 mt-0.5" />
                      )}
                      <span className="line-clamp-1">{benefit}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-charcoal-lighter italic">No specific perks listed.</p>
              )}
            </div>
          );
        })}
      </div>
      {!isAuthenticated && (
        <p className="text-[11px] text-charcoal-lighter mt-3">
          <Link href="/register" className="text-secondary hover:underline font-medium">Create an account</Link> to start earning points toward these tiers.
        </p>
      )}
    </div>
  );
}

export function Footer() {
  const { store_name, social_links, payment_methods, loaded } = useStoreSettings();
  const enabledPayments = payment_methods.filter((m) => m.enabled).map((m) => m.name);
  const openChat = useChatStore((s) => s.openChat);
  // Store name only renders once real settings load — avoids a one-frame
  // flash of the hardcoded default if the admin ever renames the store.
  const displayName = loaded ? store_name : "";

  return (
    <footer className="bg-pearl border-t border-border/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block mb-4">
              <Image src="/logo.png" alt={displayName || "Store logo"} width={320} height={124} className="h-[72px] sm:h-[90px] lg:h-[120px] w-auto" />
            </Link>
            <p className="text-sm text-charcoal-lighter leading-relaxed mb-4">
              Premium beauty & lifestyle products, curated with love for the modern woman in Bangladesh.
            </p>
            <div className="flex gap-3">
              {social_links.map((link) => {
                const platform = getPlatform(link.platform);
                if (!platform || !link.url) return null;
                const href = link.platform === "whatsapp" ? `https://wa.me/${link.url.replace(/[^0-9]/g, "")}` : link.url;
                return <SocialIconButton key={link.platform} platform={platform} href={href} />;
              })}
            </div>
          </div>

          {/* Link Columns */}
          {Object.values(FOOTER_LINKS).map((section) => (
            <div key={section.title}>
              <h4 className="font-heading text-sm font-semibold text-charcoal mb-4 tracking-wide">{section.title}</h4>
              <ul className="space-y-2.5">
                {section.links.map((link) =>
                  link.href === "#chat" ? (
                    <li key={link.label}>
                      <button
                        onClick={() => openChat("help_and_support")}
                        className="text-sm text-charcoal-lighter hover:text-secondary transition-colors text-left"
                      >
                        {link.label}
                      </button>
                    </li>
                  ) : (
                    <li key={link.label}><Link href={link.href} className="text-sm text-charcoal-lighter hover:text-secondary transition-colors">{link.label}</Link></li>
                  )
                )}
              </ul>
            </div>
          ))}

          <FooterMembershipBenefits />
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center gap-3 text-xs text-charcoal-lighter sm:flex-row sm:justify-between sm:gap-4">
          {displayName && (
            <>
              <p>&copy; {new Date().getFullYear()} {displayName}. All rights reserved.</p>
              <p className="flex items-center gap-1.5">Developed by <span className="font-heading font-semibold text-secondary italic tracking-wide">{displayName}</span></p>
            </>
          )}
          {enabledPayments.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
              <span className="font-medium">We Accept:</span>
              {enabledPayments.map((name) => <span key={name}>{name}</span>)}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
