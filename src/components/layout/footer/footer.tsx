"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { FOOTER_LINKS } from "@/data/constants/navigation";

export function Footer() {
  const shouldReduceMotion = useReducedMotion();

  // Restrained scroll-in for the footer columns — the last thing every visitor
  // sees deserves the same finish as the rest of the page. Fires once.
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: shouldReduceMotion ? 0 : 0.08 } },
  };
  const item = shouldReduceMotion
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } } };

  return (
    <footer className="bg-pearl border-t border-border/30">
      {/* Main Footer */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-8"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {/* Brand */}
          <motion.div variants={item} className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block mb-4">
              <Image src="/logo.png" alt="ChineXa" width={320} height={124} className="h-[120px] w-auto dark:bg-image-surface dark:rounded-xl dark:px-3 dark:py-1.5" />
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
          </motion.div>

          {/* Link Columns */}
          {Object.values(FOOTER_LINKS).map((section) => (
            <motion.div variants={item} key={section.title}>
              {/* h3 (not h4) so the page heading order stays sequential
                  (h1 → h2 sections → h3 footer) with no skipped level. */}
              <h3 className="font-heading text-sm font-semibold text-charcoal mb-4 tracking-wide">
                {section.title}
              </h3>
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
            </motion.div>
          ))}
        </motion.div>

        <Separator className="my-8" />

        {/* Accepted payments — EPS gateway badge (light/dark aware) */}
        <div className="flex justify-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/eps/eps-footer-light.png" alt="Pay with EPS — Visa, Mastercard, Amex, bKash, Nagad, Rocket and more" className="h-9 sm:h-10 w-auto max-w-full dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/eps/eps-footer-dark.png" alt="Pay with EPS — Visa, Mastercard, Amex, bKash, Nagad, Rocket and more" className="h-9 sm:h-10 w-auto max-w-full hidden dark:block" />
        </div>

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-charcoal-lighter">
          <p>
            &copy; {new Date().getFullYear()} ChineXa. All rights reserved.
          </p>
          <p>Developed by ChineXa</p>
        </div>
      </div>
    </footer>
  );
}
