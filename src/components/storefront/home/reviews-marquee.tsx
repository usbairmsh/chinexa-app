"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

interface ReviewItem {
  name: string;
  rating: number;
  text: string;
  product: string;
}

export function ReviewsMarquee() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);

  useEffect(() => {
    fetch("/api/reviews?is_approved=true&limit=20")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setReviews(data.map((r: Record<string, unknown>) => ({
            name: (r.customer_name as string || "Customer").split(" ").map((n, i) => i === 0 ? n : n[0] + ".").join(" "),
            rating: Number(r.rating),
            text: r.comment as string,
            product: (r.product_name as string) || "Product",
          })));
        }
      })
      .catch(() => {});
  }, []);

  if (reviews.length === 0) return null;

  return (
    <section className="py-8 sm:py-10 lg:py-12 bg-white overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal mb-2">
            Loved by Thousands
          </h2>
          <p className="text-charcoal-lighter">What our customers are saying</p>
        </motion.div>
      </div>

      {/* Marquee */}
      <div className="relative">
        <div className="flex gap-6 animate-marquee">
          {[...reviews, ...reviews].map((review, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-80 rounded-2xl border border-border/30 bg-pearl/50 p-6"
            >
              <Quote className="h-6 w-6 text-primary-dark mb-3" />
              <p className="text-sm text-charcoal leading-relaxed mb-4">
                &ldquo;{review.text}&rdquo;
              </p>
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star
                    key={j}
                    className={`h-3.5 w-3.5 ${j < review.rating ? "text-gold fill-gold" : "text-border"}`}
                  />
                ))}
              </div>
              <p className="text-sm font-medium text-charcoal">{review.name}</p>
              <p className="text-xs text-charcoal-lighter">{review.product}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
