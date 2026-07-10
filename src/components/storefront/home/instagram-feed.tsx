"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { InstagramFeedContent } from "@/types/instagram-feed";

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);

export function InstagramFeed() {
  const [content, setContent] = useState<InstagramFeedContent | null>(null);

  useEffect(() => {
    fetch("/api/settings?key=instagram_feed")
      .then((r) => r.json())
      .then((data) => { if (data?.value) setContent(data.value); })
      .catch(() => {});
  }, []);

  // No fake posts — hide the section entirely until the admin has saved at
  // least one real post.
  if (!content || content.posts.length === 0) return null;

  return (
    <section className="py-8 sm:py-10 lg:py-12 bg-pearl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <InstagramIcon className="h-5 w-5 text-secondary" />
            <span className="text-sm font-medium text-secondary">{content.handle}</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal">
            Follow Our Journey
          </h2>
        </motion.div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {content.posts.map((post, index) => (
            <motion.a
              key={post.id}
              href={post.link || "#"}
              target={post.link ? "_blank" : undefined}
              rel={post.link ? "noopener noreferrer" : undefined}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="group relative aspect-square overflow-hidden rounded-xl"
            >
              <Image
                src={post.image}
                alt="Instagram post"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                sizes="(max-width: 640px) 33vw, 16vw"
              />
              <div className="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/30 transition-colors flex items-center justify-center">
                <InstagramIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
