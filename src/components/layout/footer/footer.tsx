"use client";

import Link from "next/link";
import Image from "next/image";
import { Mail, Phone, MapPin, ArrowUp } from "lucide-react";
import { motion } from "framer-motion";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { getPlatform, SocialIconButton } from "@/lib/social-platforms";
import { useChatStore } from "@/stores/chat.store";

// Static footer structure — no longer admin-editable. Kept to two link
// columns so the footer stays scannable rather than turning into a sitemap.
const FOOTER_COLUMNS = [
  {
    title: "Help",
    links: [
      { label: "Get Help", href: "#chat" },
      { label: "FAQ", href: "/faq" },
      { label: "Track Order", href: "/track-order" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
  {
    title: "About",
    links: [
      { label: "Our Story", href: "/about" },
      { label: "Membership", href: "/membership" },
      { label: "Privacy Policy", href: "/policies/privacy" },
      { label: "Terms of Service", href: "/policies/terms" },
    ],
  },
];

export function Footer() {
  const { store_name, store_email, store_phone, store_address, social_links, payment_methods, loaded } = useStoreSettings();
  const enabledPayments = payment_methods.filter((m) => m.enabled);
  const openChat = useChatStore((s) => s.openChat);
  // Store name only renders once real settings load — avoids a one-frame
  // flash of the hardcoded default if the admin ever renames the store.
  const displayName = loaded ? store_name : "";

  const contactItems = [
    store_phone && { icon: Phone, label: store_phone, href: `tel:${store_phone.replace(/[\s-]/g, "")}` },
    store_email && { icon: Mail, label: store_email, href: `mailto:${store_email}` },
    store_address && { icon: MapPin, label: store_address, href: undefined },
  ].filter((v): v is { icon: typeof Phone; label: string; href?: string } => !!v);

  return (
    <footer className="relative bg-pearl border-t border-border/60">
      {/* Thin brand-color accent — a quiet signature line rather than a heavy divider */}
      <div className="h-[3px] w-full bg-gradient-to-r from-primary via-secondary to-primary" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_0.8fr_1fr]">
          {/* Brand + contact */}
          <div>
            <Link href="/" className="inline-block mb-3">
              <Image src="/logo.png" alt={displayName || "Store logo"} width={320} height={124} className="h-[166px] sm:h-[203px] w-auto" />
            </Link>

            {contactItems.length > 0 && (
              <ul className="space-y-2 mb-4">
                {contactItems.map((item) => {
                  const Icon = item.icon;
                  const content = (
                    <span className="flex items-start gap-2 text-sm text-charcoal-lighter">
                      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-secondary" />
                      <span className="leading-snug">{item.label}</span>
                    </span>
                  );
                  return (
                    <li key={item.label}>
                      {item.href ? (
                        <a href={item.href} className="inline-block hover:text-charcoal transition-colors">{content}</a>
                      ) : content}
                    </li>
                  );
                })}
              </ul>
            )}

            {social_links.some((l) => l.url) && (
              <div className="flex flex-wrap gap-2">
                {social_links.map((link) => {
                  const platform = getPlatform(link.platform);
                  if (!platform || !link.url) return null;
                  const href = link.platform === "whatsapp" ? `https://wa.me/${link.url.replace(/[^0-9]/g, "")}` : link.url;
                  return <SocialIconButton key={link.platform} platform={platform} href={href} />;
                })}
              </div>
            )}
          </div>

          {/* Static link columns */}
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h4 className="font-heading text-[12px] font-semibold text-secondary mb-3 tracking-[0.12em] uppercase">
                {column.title}
              </h4>
              <ul className="space-y-2">
                {column.links.map((link) =>
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
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-charcoal-lighter hover:text-secondary transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}

          {/* We Accept — its own column on desktop so payment trust signals
              read as a distinct block instead of being squeezed into the
              bottom bar alongside the copyright line. */}
          {enabledPayments.length > 0 && (
            <div>
              <h4 className="font-heading text-[12px] font-semibold text-secondary mb-3 tracking-[0.12em] uppercase">
                We Accept
              </h4>
              <div className="flex flex-wrap gap-2">
                {enabledPayments.map((m) =>
                  m.icon ? (
                    <span key={m.id} title={m.name} className="flex h-7 items-center rounded-md border border-border/70 bg-white px-2 shadow-sm">
                      <Image
                        src={m.icon}
                        alt={m.name}
                        width={40}
                        height={20}
                        unoptimized={m.icon.startsWith("data:") || m.icon.includes("/uploads/")}
                        className="h-4 w-auto object-contain"
                      />
                    </span>
                  ) : (
                    <span key={m.id} className="rounded-md border border-border/70 bg-white px-2 py-1 text-[10px] font-medium text-charcoal-light shadow-sm">
                      {m.name}
                    </span>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        <div className="my-7 h-px w-full bg-border/60" />

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          {displayName && (
            <p className="text-xs text-charcoal-lighter order-2 sm:order-1">
              &copy; {new Date().getFullYear()} {displayName}. All rights reserved.
            </p>
          )}

          {/* Back to top — small, quiet, and consistent with the header
              logo's own scroll-to-top affordance rather than a competing idea. */}
          <motion.button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.92 }}
            className="order-1 sm:order-2 flex items-center gap-1.5 h-8 pl-3 pr-1 rounded-full border border-border/60 bg-white text-xs font-medium text-charcoal-light hover:text-secondary hover:border-secondary/40 transition-colors shadow-sm"
            aria-label="Back to top"
          >
            Back to top
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary-light text-secondary">
              <ArrowUp className="h-3 w-3" />
            </span>
          </motion.button>
        </div>
      </div>
    </footer>
  );
}
