"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Heart, Sparkles, Globe, Users } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";

const values = [
  { icon: Sparkles, title: "Authenticity", description: "Every product is 100% genuine — sourced directly from authorized distributors and brands worldwide." },
  { icon: Heart, title: "Passion", description: "We are passionate about beauty and dedicated to helping every woman feel her most confident self." },
  { icon: Globe, title: "Global Reach", description: "From Korea to France, we bring the world's finest beauty products to your doorstep in Bangladesh." },
  { icon: Users, title: "Community", description: "We're building more than a store — we're creating a community of beauty lovers who inspire each other." },
];

export default function AboutPage() {
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
              <p className="text-secondary text-sm font-medium tracking-widest uppercase mb-4">Who We Are</p>
              <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal mb-6">
                Beauty that speaks to your soul
              </h2>
              <div className="space-y-4 text-charcoal-light leading-relaxed">
                <p>
                  ChineXa was born in Dhaka, Bangladesh, from a simple but powerful belief: every woman deserves access to
                  the world&apos;s finest beauty products without compromise on quality or authenticity.
                </p>
                <p>
                  Founded in 2024, we started as a small curated collection of imported skincare and quickly grew into
                  Bangladesh&apos;s most trusted destination for premium beauty, luxury bags, exquisite jewelry, fine fragrances,
                  and designer shoes.
                </p>
                <p>
                  Our team personally sources each product from authorized distributors across Korea, Japan, France, Italy,
                  the UK, and the USA. When you shop with ChineXa, you&apos;re not just buying a product — you&apos;re investing
                  in authenticity, quality, and a brand that truly cares about your beauty journey.
                </p>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
              <div className="relative aspect-[4/5] rounded-3xl overflow-hidden">
                <Image src="https://picsum.photos/seed/about-hero/800/1000" alt="ChineXa team" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
              </div>
              <div className="absolute -bottom-4 -left-4 w-40 h-40 rounded-2xl bg-primary/30 -z-10" />
              <div className="absolute -top-4 -right-4 w-28 h-28 rounded-full bg-secondary/20 -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-pearl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal">Our Values</h2>
            <p className="text-charcoal-lighter mt-2">What drives us every single day</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, i) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl p-6 text-center shadow-card"
              >
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light mb-4">
                  <value.icon className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="font-heading text-base font-semibold text-charcoal mb-2">{value.title}</h3>
                <p className="text-sm text-charcoal-lighter leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {[
              { value: "300+", label: "Products" },
              { value: "10K+", label: "Happy Customers" },
              { value: "7", label: "Categories" },
              { value: "6", label: "Countries Sourced" },
            ].map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <p className="font-heading text-3xl sm:text-4xl font-bold text-gradient-luxury">{stat.value}</p>
                <p className="text-sm text-charcoal-lighter mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
