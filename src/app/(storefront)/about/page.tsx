"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import type { OurStoryContent } from "@/types/our-story";
import { OUR_STORY_ICON_MAP } from "@/lib/our-story-icons";

export default function AboutPage() {
  const [story, setStory] = useState<OurStoryContent | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/settings?key=our_story")
      .then((r) => r.json())
      .then((data) => { if (data?.value) setStory(data.value); })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return null;

  if (!story) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="font-heading text-2xl font-semibold text-charcoal mb-2">Our Story</h1>
        <p className="text-charcoal-lighter">This page hasn&apos;t been set up yet. Check back soon.</p>
      </div>
    );
  }
  const content = story;

  return (
    <div className="bg-white">
      {/* Hero */}
      <div className="bg-hero-gradient py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={[{ label: "About Us" }]} />
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-charcoal mt-6"
          >
            Our Story
          </motion.h1>
        </div>
      </div>

      {/* Story */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <p className="text-secondary text-sm font-medium tracking-widest uppercase mb-4">{content.eyebrow}</p>
              <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal mb-6">
                {content.heading}
              </h2>
              <div className="space-y-4 text-charcoal-light leading-relaxed">
                {content.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative overflow-hidden">
              <div className="relative aspect-[4/5] rounded-3xl overflow-hidden">
                <Image src={content.image} alt="ChineXa team" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
              </div>
              <div className="absolute -bottom-4 -left-4 w-40 h-40 rounded-2xl bg-primary/30 -z-10" />
              <div className="absolute -top-4 -right-4 w-28 h-28 rounded-full bg-secondary/20 -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      {content.values.length > 0 && (
        <section className="py-16 bg-pearl">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal">{content.values_heading}</h2>
              <p className="text-charcoal-lighter mt-2">{content.values_subheading}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {content.values.map((value, i) => {
                const Icon = OUR_STORY_ICON_MAP[value.icon] || OUR_STORY_ICON_MAP.Sparkles;
                return (
                  <motion.div
                    key={value.title + i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white rounded-2xl p-6 text-center shadow-card"
                  >
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light mb-4">
                      <Icon className="h-6 w-6 text-secondary" />
                    </div>
                    <h3 className="font-heading text-base font-semibold text-charcoal mb-2">{value.title}</h3>
                    <p className="text-sm text-charcoal-lighter leading-relaxed">{value.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      {content.stats.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
              {content.stats.map((stat, i) => (
                <motion.div key={stat.label + i} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <p className="font-heading text-3xl sm:text-4xl font-bold text-gradient-luxury">{stat.value}</p>
                  <p className="text-sm text-charcoal-lighter mt-1">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
