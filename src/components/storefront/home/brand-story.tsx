"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { OurStoryContent } from "@/types/our-story";

export function BrandStory() {
  const [story, setStory] = useState<OurStoryContent | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/settings?key=our_story")
      .then((r) => r.json())
      .then((data) => { if (data?.value) setStory(data.value); })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  // No fake placeholder content — if the admin hasn't saved a real story yet,
  // this section simply doesn't render (matches every other homepage section's
  // "hide until there's real data" convention).
  if (!checked || !story) return null;
  const content = story;

  return (
    <section className="py-8 sm:py-10 lg:py-12 bg-pearl overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-secondary text-sm font-medium tracking-widest uppercase mb-4">
              Our Story
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-semibold text-charcoal mb-6 leading-tight">
              {content.heading}
            </h2>
            {content.paragraphs.slice(0, 2).map((p, i) => (
              <p key={i} className={i === 0 ? "text-charcoal-lighter leading-relaxed mb-4" : "text-charcoal-lighter leading-relaxed mb-8"}>
                {p}
              </p>
            ))}
            <Link href="/about">
              <Button variant="secondary" size="lg">Discover More</Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden">
              <Image
                src={content.image}
                alt="ChineXa brand story"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 w-48 h-48 rounded-2xl bg-primary/30 -z-10 hidden sm:block" />
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-secondary/20 -z-10 hidden sm:block" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
