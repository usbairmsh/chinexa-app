"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { faqSections } from "@/data/faq";


export default function FaqPage() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-hero-gradient py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={[{ label: "FAQ" }]} />
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-semibold text-charcoal mt-4">
            Frequently Asked Questions
          </h1>
          <p className="text-charcoal-lighter mt-3 max-w-lg">
            Everything you need to know about shopping with ChineXa.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
        {faqSections.map((section, si) => (
          <motion.div
            key={section.title}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: si * 0.08, duration: 0.3, ease: "easeOut" }}
            className="rounded-2xl border border-border/60 bg-white shadow-card hover:shadow-card-hover transition-shadow duration-300 px-5 sm:px-8 py-6 sm:py-8"
          >
            <h2 className="font-heading text-xl sm:text-2xl font-semibold text-charcoal mb-2">{section.title}</h2>
            <Accordion type="single" collapsible>
              {section.faqs.map((faq, i) => (
                <AccordionItem key={i} value={`${section.title}-${i}`}>
                  <AccordionTrigger className="text-left text-base">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-charcoal-lighter leading-relaxed">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
