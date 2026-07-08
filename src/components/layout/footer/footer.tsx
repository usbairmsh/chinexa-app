"use client";

import Link from "next/link";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { FOOTER_LINKS } from "@/data/constants/navigation";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { getPlatform, SocialIconButton } from "@/lib/social-platforms";
import { useChatStore } from "@/stores/chat.store";

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
