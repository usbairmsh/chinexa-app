"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { getPlatform } from "@/lib/social-platforms";
import { useChatStore } from "@/stores/chat.store";

export function Footer() {
  const { store_name, social_links, payment_methods, footer_config, loaded } = useStoreSettings();
  const enabledPayments = payment_methods.filter((m) => m.enabled).map((m) => m.name);
  const openChat = useChatStore((s) => s.openChat);
  // Store name only renders once real settings load — avoids a one-frame
  // flash of the hardcoded default if the admin ever renames the store.
  const displayName = loaded ? store_name : "";

  return (
    <footer className="relative bg-charcoal text-pearl overflow-hidden">
      {/* Ambient gold glow, top hairline */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-secondary/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-12 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-4">
            <Link href="/" className="inline-block mb-5">
              <Image src="/logo.png" alt={displayName || "Store logo"} width={320} height={124} className="h-[64px] sm:h-[80px] lg:h-[104px] w-auto brightness-0 invert" />
            </Link>
            <p className="text-sm text-pearl/60 leading-relaxed mb-6 max-w-xs">
              Premium beauty &amp; lifestyle products, curated with love for the modern woman in Bangladesh.
            </p>
            {social_links.some((l) => l.url) && (
              <div className="flex flex-wrap gap-2.5">
                {social_links.map((link) => {
                  const platform = getPlatform(link.platform);
                  if (!platform || !link.url) return null;
                  const href = link.platform === "whatsapp" ? `https://wa.me/${link.url.replace(/[^0-9]/g, "")}` : link.url;
                  return (
                    <a
                      key={link.platform}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={platform.name}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-pearl/15 opacity-80 transition-all duration-300 hover:opacity-100 hover:border-gold/60 hover:-translate-y-0.5"
                    >
                      {platform.whiteIcon}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Link Columns — fully admin-managed via /admin/footer */}
          <div className="col-span-2 grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 md:col-span-8 md:gap-12">
            {footer_config.columns.map((column) => (
              <div key={column.id}>
                <h4 className="font-heading text-[13px] font-semibold text-gold mb-5 tracking-[0.15em] uppercase">
                  {column.title}
                </h4>
                <ul className="space-y-3">
                  {column.links.map((link) =>
                    link.href === "#chat" ? (
                      <li key={link.id}>
                        <button
                          onClick={() => openChat("help_and_support")}
                          className="group inline-flex items-center gap-1 text-sm text-pearl/65 hover:text-pearl transition-colors text-left"
                        >
                          <span className="relative">
                            {link.label}
                            <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
                          </span>
                        </button>
                      </li>
                    ) : (
                      <li key={link.id}>
                        <Link
                          href={link.href}
                          className="group inline-flex items-center gap-1 text-sm text-pearl/65 hover:text-pearl transition-colors"
                        >
                          <span className="relative">
                            {link.label}
                            <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
                          </span>
                        </Link>
                      </li>
                    )
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="my-10 h-px w-full bg-gradient-to-r from-transparent via-pearl/15 to-transparent" />

        <div className="flex flex-col items-center gap-4 text-xs text-pearl/45 sm:flex-row sm:justify-between sm:gap-4">
          {displayName && (
            <p className="order-2 sm:order-1">&copy; {new Date().getFullYear()} {displayName}. All rights reserved.</p>
          )}
          {enabledPayments.length > 0 && (
            <div className="order-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 sm:order-2">
              <span className="font-medium tracking-wide text-pearl/55">We Accept</span>
              <span className="h-3 w-px bg-pearl/15" />
              {enabledPayments.map((name, i) => (
                <span key={name} className="flex items-center gap-3">
                  {i > 0 && <span className="h-1 w-1 rounded-full bg-pearl/25" />}
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {displayName && (
        <div className="relative border-t border-pearl/10 bg-black/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-center">
            <p className="flex items-center gap-1.5 text-[11px] text-pearl/40 tracking-wide">
              Crafted by
              <span className="inline-flex items-center gap-0.5 font-heading font-semibold text-gold italic tracking-wide">
                {displayName}
                <ArrowUpRight className="h-3 w-3" />
              </span>
            </p>
          </div>
        </div>
      )}
    </footer>
  );
}
