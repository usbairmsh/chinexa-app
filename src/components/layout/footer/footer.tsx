"use client";

import Link from "next/link";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { FOOTER_LINKS } from "@/data/constants/navigation";
import { useStoreSettings } from "@/hooks/use-store-settings";

export function Footer() {
  const { payment_methods } = useStoreSettings();
  const enabledPayments = payment_methods.filter((m) => m.enabled);

  return (
    <footer className="bg-pearl border-t border-border/30">
      {/* Main Footer */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block mb-4">
              <Image src="/logo.png" alt="ChineXa" width={320} height={124} className="h-[120px] w-auto" />
            </Link>
            <p className="text-sm text-charcoal-lighter leading-relaxed mb-4">
              Premium beauty & lifestyle products, curated with love for the modern woman in Bangladesh.
            </p>
            <div className="flex gap-3">
              {/* Instagram — gradient pink/purple/orange */}
              <a
                href="https://www.instagram.com/_chinexa_?igsh=MWJiZzJpb3M4aXMzaw=="
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#dc2743] text-white hover:opacity-80 transition-opacity"
                aria-label="Instagram"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              {/* Facebook — blue */}
              <a
                href="https://www.facebook.com/share/1EFvvLRDrC/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1877F2] text-white hover:opacity-80 transition-opacity"
                aria-label="Facebook"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              {/* YouTube — red */}
              <a
                href="https://youtube.com/@chinexabd?si=Wm6xzzuw4Upikn3X"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FF0000] text-white hover:opacity-80 transition-opacity"
                aria-label="YouTube"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
              </a>
              {/* TikTok — black */}
              <a
                href="https://www.tiktok.com/@_chinexa_?_r=1&_t=ZS-97auqfDjakK"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#010101] text-white hover:opacity-80 transition-opacity"
                aria-label="TikTok"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
              </a>
            </div>
          </div>

          {/* Link Columns */}
          {Object.values(FOOTER_LINKS).map((section) => (
            <div key={section.title}>
              <h4 className="font-heading text-sm font-semibold text-charcoal mb-4 tracking-wide">
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-charcoal-lighter hover:text-secondary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8" />

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-charcoal-lighter">
          <p>
            &copy; {new Date().getFullYear()} ChineXa. All rights reserved.
          </p>
          <p>Developed by ChineXa</p>
          {enabledPayments.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="font-medium">We Accept:</span>
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
          )}
        </div>
      </div>
    </footer>
  );
}
