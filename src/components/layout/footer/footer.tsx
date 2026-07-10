"use client";

import Link from "next/link";
import Image from "next/image";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { getPlatform, SocialIconButton } from "@/lib/social-platforms";
import { useChatStore } from "@/stores/chat.store";

// Static footer structure — no longer admin-editable. Simplified to two
// essential columns to keep the footer as short as possible.
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
  const { store_name, social_links, payment_methods, loaded } = useStoreSettings();
  const enabledPayments = payment_methods.filter((m) => m.enabled);
  const openChat = useChatStore((s) => s.openChat);
  // Store name only renders once real settings load — avoids a one-frame
  // flash of the hardcoded default if the admin ever renames the store.
  const displayName = loaded ? store_name : "";

  return (
    <footer className="bg-pearl border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-block mb-3">
              <Image src="/logo.png" alt={displayName || "Store logo"} width={320} height={124} className="h-[72px] sm:h-[90px] lg:h-[117px] w-auto" />
            </Link>
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
          <div className="grid grid-cols-2 gap-x-10 gap-y-4 sm:flex sm:gap-12">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <h4 className="font-heading text-[12px] font-semibold text-secondary mb-2.5 tracking-[0.12em] uppercase">
                  {column.title}
                </h4>
                <ul className="space-y-1.5">
                  {column.links.map((link) =>
                    link.href === "#chat" ? (
                      <li key={link.label}>
                        <button
                          onClick={() => openChat("help_and_support")}
                          className="text-sm text-charcoal-lighter hover:text-charcoal transition-colors text-left"
                        >
                          {link.label}
                        </button>
                      </li>
                    ) : (
                      <li key={link.label}>
                        <Link href={link.href} className="text-sm text-charcoal-lighter hover:text-charcoal transition-colors">
                          {link.label}
                        </Link>
                      </li>
                    )
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="my-6 h-px w-full bg-border/60" />

        <div className="flex flex-col items-center gap-3 text-xs text-charcoal-lighter sm:flex-row sm:justify-between">
          {displayName && (
            <p className="order-2 sm:order-1">&copy; {new Date().getFullYear()} {displayName}. All rights reserved.</p>
          )}
          {enabledPayments.length > 0 && (
            <div className="order-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 sm:order-2">
              <span className="font-medium tracking-wide text-charcoal-light">We Accept</span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {enabledPayments.map((m) =>
                  m.icon ? (
                    <span key={m.id} title={m.name} className="flex h-6 items-center rounded-md border border-border/70 bg-white px-1.5">
                      <Image
                        src={m.icon}
                        alt={m.name}
                        width={40}
                        height={20}
                        unoptimized={m.icon.startsWith("data:") || m.icon.includes("/uploads/")}
                        className="h-3.5 w-auto object-contain"
                      />
                    </span>
                  ) : (
                    <span key={m.id} className="rounded-md border border-border/70 bg-white px-1.5 py-0.5 text-[10px] font-medium text-charcoal-light">
                      {m.name}
                    </span>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
