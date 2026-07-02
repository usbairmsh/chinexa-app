"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBanners } from "@/hooks/queries/use-banners";

export function HeroSection() {
  const { data: banners } = useBanners("hero");
  const [current, setCurrent] = useState(0);

  const slides = banners || [];

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
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

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
            className="font-heading text-4xl sm:text-5xl lg:text-7xl font-bold text-charcoal mb-4"
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

  return (
    <section className="relative h-[70vh] sm:h-[80vh] overflow-hidden bg-pearl">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          <Image
            src={slides[current].image}
            alt={slides[current].title}
            fill
            className="object-cover"
            style={(() => {
              const fp = slides[current].focal_point;
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
          {/* Strong gradient overlay for text contrast on any image */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

          <div className="absolute inset-0 flex items-center">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
              <div className="max-w-lg drop-shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
                <motion.p
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm font-medium tracking-widest uppercase mb-3"
                  style={{ color: "rgba(255,255,255,0.85)", textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}
                >
                  {slides[current].subtitle}
                </motion.p>
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight"
                  style={{ color: "#FFFFFF", textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}
                >
                  {slides[current].title}
                </motion.h2>
                {slides[current].cta_text && slides[current].link && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Link href={slides[current].link!}>
                      <span className="group inline-flex items-center gap-2.5 h-12 px-8 sm:h-14 sm:px-10 rounded-full bg-white text-charcoal text-sm sm:text-[15px] font-body font-semibold tracking-wide shadow-[0_4px_30px_rgba(0,0,0,0.2)] hover:bg-secondary hover:text-white hover:shadow-[0_6px_35px_rgba(192,57,43,0.4)] active:scale-[0.96] transition-all duration-300">
                        {slides[current].cta_text}
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
