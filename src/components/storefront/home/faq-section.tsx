"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import type { FaqItem } from "@/types/faq";

export function FaqSection() {
  const [faqs, setFaqs] = useState<FaqItem[] | null>(null);

  useEffect(() => {
    fetch("/api/settings?key=faq_items")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data?.value)) setFaqs(data.value); })
      .catch(() => {});
  }, []);

  // No hardcoded questions — hide until the admin has saved real FAQ content.
  if (!faqs || faqs.length === 0) return null;

  return (
    <section className="py-8 sm:py-10 lg:py-12 bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal mb-2">
            Frequently Asked Questions
          </h2>
          <p className="text-charcoal-lighter">
            Everything you need to know about shopping with ChineXa
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left font-medium">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-charcoal-lighter leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
