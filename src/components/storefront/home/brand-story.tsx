"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function BrandStory() {
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
              True Beauty
              <br />
              <span className="text-gradient-luxury">Knows No Borders</span>
            </h2>
            <p className="text-charcoal-lighter leading-relaxed mb-4">
              ChineXa was born from a simple belief: every woman deserves access to the world&apos;s finest beauty products. Based in Bangladesh, we curate premium skincare, luxury bags, exquisite jewelry, and fine fragrances from trusted global brands.
            </p>
            <p className="text-charcoal-lighter leading-relaxed mb-8">
              We believe beauty is not about changing who you are — it&apos;s about celebrating who you already are. Each product in our collection is carefully selected to help you feel confident, radiant, and unapologetically you.
            </p>
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
                src="https://picsum.photos/seed/brand-story/800/1000"
                alt="ChineXa brand story"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 w-48 h-48 rounded-2xl bg-primary/30 -z-10" />
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-secondary/20 -z-10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
