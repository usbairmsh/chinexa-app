"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { Banner } from "@/types/banner";

function parseCrop(val?: string) {
  if (!val) return { x: 50, y: 50, zoom: 1 };
  try { const c = JSON.parse(val); return { x: c.x ?? 50, y: c.y ?? 50, zoom: c.zoom ?? 1 }; }
  catch { return { x: 50, y: 50, zoom: 1 }; }
}

// ─── Promo Banner Strip ───
export function PromoBannerStrip() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/banners?position=promo")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setBanners(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="py-8 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-pearl animate-pulse aspect-[16/7]" />
        </div>
      </section>
    );
  }

  if (banners.length === 0) return null;

  return (
    <section className="py-8 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`grid gap-4 ${banners.length === 1 ? "grid-cols-1" : banners.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {banners.map((banner, i) => {
            const crop = parseCrop(banner.focal_point);
            const content = (
              <motion.div
                key={banner.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative rounded-2xl overflow-hidden aspect-[16/7] group"
              >
                <Image
                  src={banner.image}
                  alt={banner.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` }}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  unoptimized={banner.image.includes("/uploads/")}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-white font-heading text-lg font-semibold">{banner.title}</h3>
                  {banner.subtitle && <p className="text-white/80 text-xs mt-0.5">{banner.subtitle}</p>}
                  {banner.cta_text && (
                    <span className="inline-block mt-2 px-4 py-2 rounded-full bg-white/90 text-charcoal text-xs font-semibold hover:bg-white transition-colors">
                      {banner.cta_text}
                    </span>
                  )}
                </div>
              </motion.div>
            );
            return banner.link ? <Link key={banner.id} href={banner.link}>{content}</Link> : content;
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Category Banner (full-width single banner) ───
export function CategoryBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/banners?position=category")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setBanners(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-pearl animate-pulse aspect-[21/7]" />
        </div>
      </section>
    );
  }

  if (banners.length === 0) return null;
  const banner = banners[0];
  const crop = parseCrop(banner.focal_point);

  const content = (
    <section className="py-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl overflow-hidden aspect-[16/9] sm:aspect-[21/7] group"
        >
          <Image
            src={banner.image}
            alt={banner.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` }}
            sizes="100vw"
            unoptimized={banner.image.includes("/uploads/")}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="px-4 sm:px-8 lg:px-12">
              <h3 className="text-white font-heading text-2xl sm:text-3xl font-bold">{banner.title}</h3>
              {banner.subtitle && <p className="text-white/80 text-sm mt-1 max-w-md">{banner.subtitle}</p>}
              {banner.cta_text && (
                <span className="inline-block mt-4 px-6 py-2 rounded-full bg-white text-charcoal text-sm font-semibold hover:bg-secondary hover:text-white hover:shadow-[0_6px_25px_rgba(122,79,160,0.3)] hover:-translate-y-[1px] active:scale-[0.96] transition-all duration-300 shadow-lg">
                  {banner.cta_text}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );

  return banner.link ? <Link href={banner.link}>{content}</Link> : content;
}

// ─── Popup Banner ───
export function PopupBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    if (typeof window !== "undefined" && sessionStorage.getItem("chinexa-popup-dismissed")) return;
    fetch("/api/banners?position=popup")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data) && data.length > 0) setTimeout(() => setBanner(data[0]), 2000); })
      .catch(() => {});
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") sessionStorage.setItem("chinexa-popup-dismissed", "1");
  };

  if (!banner || dismissed) return null;
  const crop = parseCrop(banner.focal_point);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleDismiss}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={handleDismiss} className="absolute top-3 right-3 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="relative aspect-[4/3]">
          <Image
            src={banner.image}
            alt={banner.title}
            fill
            className="object-cover"
            style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` }}
            sizes="500px"
            unoptimized={banner.image.includes("/uploads/")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h3 className="text-white font-heading text-xl font-bold">{banner.title}</h3>
            {banner.subtitle && <p className="text-white/80 text-sm mt-1">{banner.subtitle}</p>}
            {banner.cta_text && banner.link && (
              <Link href={banner.link} onClick={handleDismiss}>
                <span className="inline-block mt-3 px-6 py-2 rounded-full bg-white text-charcoal text-sm font-semibold hover:bg-secondary hover:text-white transition-all">
                  {banner.cta_text}
                </span>
              </Link>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
