"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBanners } from "@/hooks/queries/use-banners";
import { DEFAULT_BANNER_SETTINGS, type BannerSettings, type TextAnimation, type CarouselTransition } from "@/types/banner";

function parseSettings(raw: unknown): BannerSettings {
  if (!raw) return DEFAULT_BANNER_SETTINGS;
  const parsed = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  return { ...DEFAULT_BANNER_SETTINGS, ...(parsed as Partial<BannerSettings> | null) };
}

/** Off-screen starting point (and exit point) for a text-animation type, framer-motion inline-props style. */
function textMotionProps(animation: TextAnimation, delay: number) {
  const base = { transition: { delay, duration: 0.6 } };
  switch (animation) {
    case "slide-left": return { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, ...base };
    case "slide-right": return { initial: { opacity: 0, x: -40 }, animate: { opacity: 1, x: 0 }, ...base };
    case "slide-up": return { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, ...base };
    case "slide-down": return { initial: { opacity: 0, y: -20 }, animate: { opacity: 1, y: 0 }, ...base };
    case "zoom": return { initial: { opacity: 0, scale: 0.85 }, animate: { opacity: 1, scale: 1 }, ...base };
    case "none": return { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0 } };
    case "fade":
    default: return { initial: { opacity: 0 }, animate: { opacity: 1 }, ...base };
  }
}

/** Slide-to-slide (image) transition, keyed off the banner's carouselTransition. */
function slideMotionProps(transition: CarouselTransition) {
  switch (transition) {
    case "slide": return { initial: { opacity: 1, x: "100%" }, animate: { opacity: 1, x: 0 }, exit: { opacity: 1, x: "-100%" } };
    case "zoom": return { initial: { opacity: 0, scale: 1.15 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.9 } };
    case "none": return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } };
    case "fade":
    default: return { initial: { opacity: 0, scale: 1.05 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 } };
  }
}

const positionHClass: Record<BannerSettings["positionH"], string> = {
  left: "items-start text-left mr-auto",
  center: "items-center text-center mx-auto",
  right: "items-end text-right ml-auto",
};

// Vertical alignment needs `flex-col` on the container for `justify-*` to act
// on the vertical axis at all — the previous version omitted flex-col, so
// "Top"/"Bottom" silently had no effect and text always rendered vertically
// centered. Minimum top/bottom padding keeps text off the banner's edges at
// every position (paired with positionHClass's horizontal padding below).
const positionVClass: Record<BannerSettings["positionV"], string> = {
  top: "justify-start",
  center: "justify-center",
  bottom: "justify-end",
};

export function HeroSection() {
  const { data: banners } = useBanners("hero");
  const [current, setCurrent] = useState(0);

  const slides = banners || [];
  const settings = slides[current] ? parseSettings(slides[current].settings) : DEFAULT_BANNER_SETTINGS;

  // Reset current if it goes out of bounds (e.g., slides array changes)
  useEffect(() => {
    if (slides.length > 0 && current >= slides.length) {
      setCurrent(0);
    }
  }, [slides.length, current]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, settings.transitionDuration || 6000);
    return () => clearInterval(timer);
  }, [slides.length, settings.transitionDuration]);

  // Show shimmer while banners are loading — no text flash
  if (!banners) {
    return (
      <section className="relative h-[70vh] sm:h-[80vh] bg-hero-gradient flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-r from-pearl via-white to-pearl animate-pulse" />
      </section>
    );
  }

  if (slides.length === 0 || !slides[current]) {
    return (
      <section className="relative h-[70vh] sm:h-[80vh] bg-hero-gradient flex items-center justify-center">
        <div className="text-center px-4">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="font-heading text-3xl sm:text-5xl lg:text-7xl font-bold text-charcoal mb-4"
          >
            True Beauty,
            <br />
            <span className="text-gradient-luxury">Knows No Borders</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-charcoal-lighter text-lg sm:text-xl max-w-lg mx-auto mb-8"
          >
            Discover curated skincare, luxury bags, exquisite jewelry, and more — exclusively at ChineXa.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center"
          >
            <Link href="/products">
              <span className="group inline-flex items-center gap-2.5 h-12 px-8 sm:h-14 sm:px-10 rounded-full bg-secondary text-white text-sm sm:text-[15px] font-body font-semibold tracking-wide hover:bg-secondary-dark hover:shadow-[0_6px_30px_rgba(192,57,43,0.4)] active:scale-[0.96] transition-all duration-300">
                Shop Now
                <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </span>
            </Link>
            <Link href="/categories/skincare">
              <span className="inline-flex items-center gap-2 h-12 px-8 sm:h-14 sm:px-10 rounded-full border-2 border-white/30 text-charcoal text-sm sm:text-[15px] font-body font-semibold tracking-wide backdrop-blur-sm hover:bg-charcoal hover:text-white hover:border-charcoal hover:shadow-[0_6px_30px_rgba(0,0,0,0.2)] active:scale-[0.96] transition-all duration-300">
                Explore Skincare
              </span>
            </Link>
          </motion.div>
        </div>
      </section>
    );
  }

  const slide = slides[current];
  const slideMotion = slideMotionProps(settings.carouselTransition);
  const showDescriptionAbove = settings.descriptionOrder === "above";

  const titleEl = settings.showTitle && (
    <motion.h2
      key="title"
      {...textMotionProps(settings.titleAnimation, 0.4)}
      className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight"
      style={{ color: "#FFFFFF", textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}
    >
      {slide.title}
    </motion.h2>
  );

  const descriptionEl = settings.showDescription && slide.subtitle && (
    <motion.p
      key="description"
      {...textMotionProps(settings.descriptionAnimation, 0.3)}
      className="text-sm font-medium tracking-widest uppercase mb-3"
      style={{ color: "rgba(255,255,255,0.85)", textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}
    >
      {slide.subtitle}
    </motion.p>
  );

  return (
    <section className="relative h-[70vh] sm:h-[80vh] overflow-hidden bg-pearl">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          {...slideMotion}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          <Image
            src={slide.image}
            alt={slide.title}
            fill
            className="object-cover"
            style={(() => {
              const fp = slide.focal_point;
              if (!fp) return { objectPosition: "50% 50%" };
              try {
                const c = JSON.parse(fp);
                return {
                  objectPosition: `${c.x ?? 50}% ${c.y ?? 50}%`,
                  transform: c.zoom && c.zoom !== 1 ? `scale(${c.zoom})` : undefined,
                  transformOrigin: `${c.x ?? 50}% ${c.y ?? 50}%`,
                };
              } catch {
                return { objectPosition: fp };
              }
            })()}
            priority
            sizes="100vw"
          />
          {/* Overlay — per-banner toggle, opacity, and blur */}
          {settings.overlayEnabled && (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right, rgba(0,0,0,${settings.overlayOpacity}), rgba(0,0,0,${settings.overlayOpacity * 0.55}), transparent)`,
                backdropFilter: settings.overlayBlur > 0 ? `blur(${settings.overlayBlur}px)` : undefined,
              }}
            />
          )}

          <div className={`absolute inset-0 flex flex-col py-10 sm:py-14 lg:py-16 ${positionVClass[settings.positionV]}`}>
            <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-14 w-full">
              <div className={`flex flex-col max-w-lg drop-shadow-[0_2px_12px_rgba(0,0,0,0.3)] ${positionHClass[settings.positionH]}`}>
                {showDescriptionAbove ? (<>{descriptionEl}{titleEl}</>) : (<>{titleEl}{descriptionEl}</>)}
                {slide.cta_text && slide.link && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Link href={slide.link}>
                      <span className="group inline-flex items-center gap-2.5 h-12 px-8 sm:h-14 sm:px-10 rounded-full bg-white text-charcoal text-sm sm:text-[15px] font-body font-semibold tracking-wide shadow-[0_4px_30px_rgba(0,0,0,0.2)] hover:bg-secondary hover:text-white hover:shadow-[0_6px_35px_rgba(192,57,43,0.4)] active:scale-[0.96] transition-all duration-300">
                        {slide.cta_text}
                        <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                      </span>
                    </Link>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => setCurrent((prev) => (prev - 1 + slides.length) % slides.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/25 backdrop-blur-md text-white hover:bg-black/40 transition-colors shadow-lg"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCurrent((prev) => (prev + 1) % slides.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/25 backdrop-blur-md text-white hover:bg-black/40 transition-colors shadow-lg"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex gap-1">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className="flex items-center justify-center h-8 w-8"
                aria-label={`Go to slide ${i + 1}`}
              >
                <span className={`h-2 rounded-full transition-all duration-300 ${
                  i === current ? "w-6 sm:w-8 bg-white" : "w-2 bg-white/50"
                }`} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
