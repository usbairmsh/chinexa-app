"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Phone } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useCountdown } from "@/hooks/use-countdown";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { DEFAULT_ANNOUNCEMENT_CONFIG, type Announcement, type AnnouncementConfig, type AnnouncementType } from "@/types/announcement";
import { cn } from "@/lib/utils";

// Per-type look: a vivid gradient bar + font treatment so each announcement is
// eye-catching and instantly recognizable to customers. Mirrors the admin
// preview themes on /admin/announcements.
const BAR_THEME: Record<AnnouncementType, { bar: string; text: string; font: string; link: string }> = {
  text: {
    bar: "bg-gradient-to-r from-secondary via-secondary-dark to-secondary",
    text: "text-white", font: "tracking-[0.04em]", link: "hover:text-white/80",
  },
  countdown: {
    bar: "bg-gradient-to-r from-rose-600 via-red-500 to-orange-500",
    text: "text-white", font: "font-heading font-bold uppercase tracking-[0.12em]", link: "hover:text-white/80",
  },
  free_shipping: {
    bar: "bg-gradient-to-r from-emerald-600 via-green-500 to-teal-500",
    text: "text-white", font: "font-heading font-semibold tracking-[0.04em]", link: "hover:text-white/80",
  },
  social_proof: {
    bar: "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400",
    text: "text-charcoal", font: "font-heading font-semibold tracking-[0.04em]", link: "hover:text-charcoal/70",
  },
};

function CountdownClock({ value }: { value: { days: number; hours: number; minutes: number; seconds: number } }) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
      <span>{pad(value.days)}</span>:<span>{pad(value.hours)}</span>:<span>{pad(value.minutes)}</span>:<span>{pad(value.seconds)}</span>
    </span>
  );
}

function AnnouncementContent({ item }: { item: Announcement }) {
  const { free_delivery_threshold } = useStoreSettings();
  const countdown = useCountdown(item.type === "countdown" ? item.endsAt : "");

  if (item.type === "text") return <>{item.message}</>;

  if (item.type === "social_proof") return <>{item.message}</>;

  if (item.type === "free_shipping") {
    return <>{item.messageTemplate.replace("{threshold}", formatCurrency(free_delivery_threshold))}</>;
  }

  if (item.type === "countdown") {
    if (countdown.expired && item.onExpire === "hide") return null;
    return (
      <span className="inline-flex items-center gap-2">
        <span>{item.label}</span>
        <CountdownClock value={countdown} />
      </span>
    );
  }

  return null;
}

/** Top utility bar — phone + rotating announcement(s) + quick links. Renders
 * nothing until real, admin-saved announcements are loaded (no placeholder
 * copy flashed in front of visitors), and nothing at all if none are enabled. */
export function AnnouncementBar() {
  const [config, setConfig] = useState<AnnouncementConfig | null>(null);
  const [phone, setPhone] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch("/api/settings?keys=announcements,store_phone")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data?.announcements || DEFAULT_ANNOUNCEMENT_CONFIG);
        if (data?.store_phone) setPhone(data.store_phone);
      })
      .catch(() => setConfig(DEFAULT_ANNOUNCEMENT_CONFIG));
  }, []);

  const activeItems = useMemo(() => (config?.items || []).filter((i) => i.enabled), [config]);

  useEffect(() => {
    if (activeItems.length <= 1) return;
    const seconds = Math.max(3, config?.rotateSeconds || 6);
    const interval = setInterval(() => setIndex((i) => (i + 1) % activeItems.length), seconds * 1000);
    return () => clearInterval(interval);
  }, [activeItems.length, config?.rotateSeconds]);

  if (!config || activeItems.length === 0) return null;

  const current = activeItems[index % activeItems.length];
  const theme = BAR_THEME[current.type];
  const messageClass = cn(
    "text-[11px] sm:text-xs text-center truncate px-2 sm:px-0 transition-colors",
    theme.text, theme.font, current.link && theme.link
  );
  // Muted version of the theme text for the side utility links.
  const sideClass = cn("transition-colors", theme.text === "text-white" ? "text-white/75 hover:text-white" : "text-charcoal/70 hover:text-charcoal");

  return (
    <div className={cn("border-b border-black/5 transition-colors duration-500", theme.bar)}>
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 flex items-center justify-between h-9">
        <span className={cn("text-[11px] hidden sm:flex items-center gap-1.5", theme.text === "text-white" ? "text-white/75" : "text-charcoal/70")}>
          {phone && (
            <>
              <Phone className="h-3 w-3" /> {phone}
            </>
          )}
        </span>

        <div className="flex-1 sm:flex-none flex justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={current.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="inline-block"
            >
              {current.link ? (
                <Link href={current.link} className={messageClass}>
                  <AnnouncementContent item={current} />
                </Link>
              ) : (
                <p className={messageClass}>
                  <AnnouncementContent item={current} />
                </p>
              )}
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-[11px]">
          <Link href="/track-order" className={sideClass}>Track Order</Link>
          <Link href="/faq" className={sideClass}>FAQ</Link>
        </div>
      </div>
    </div>
  );
}
