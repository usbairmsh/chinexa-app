"use client";

import { motion } from "framer-motion";
import { Shield, Truck, RotateCcw, Headphones } from "lucide-react";

const defaultBadges = [
  { title: "100% Authentic", description: "Every product is genuine and verified" },
  { title: "Free Shipping", description: "On orders above ৳3,000" },
  { title: "Easy Returns", description: "7-day hassle-free return policy" },
  { title: "24/7 Support", description: "We're here whenever you need us" },
];

const icons = [Shield, Truck, RotateCcw, Headphones];

interface TrustBadgesProps {
  badges?: { title: string; description: string }[];
}

export function TrustBadges({ badges }: TrustBadgesProps) {
  const items = badges?.length ? badges : defaultBadges;

  return (
    <section className="py-16 bg-white border-y border-border/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
          {items.map((badge, index) => {
            const Icon = icons[index % icons.length];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light mb-4">
                  <Icon className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="font-heading text-base font-semibold text-charcoal mb-1">
                  {badge.title}
                </h3>
                <p className="text-xs text-charcoal-lighter">{badge.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
