"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DEFAULT_OUR_STORY, type OurStoryContent } from "@/types/our-story";

export function BrandStory() {
  const [story, setStory] = useState<OurStoryContent | null>(null);

  useEffect(() => {
    fetch("/api/settings?key=our_story")
      .then((r) => r.json())
      .then((data) => { if (data?.value) setStory({ ...DEFAULT_OUR_STORY, ...data.value }); })
      .catch(() => {});
  }, []);

  // Render nothing until settings resolve (or genuinely fall back to the
  // built-in defaults, never a flash of one before the other) — matches the
  // "no demo content before real data loads" convention used across the app.
  const content = story || DEFAULT_OUR_STORY;

  return (
    <section className="py-20 bg-pearl overflow-hidden">
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
