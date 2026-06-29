"use client";

import { motion } from "framer-motion";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const faqs = [
  {
    question: "Are all products authentic?",
    answer: "Yes, every product sold on ChineXa is 100% authentic. We source directly from authorized distributors and brands. Each imported product comes with verification of authenticity.",
  },
  {
    question: "How long does shipping take?",
    answer: "Standard shipping within Dhaka takes 1-2 business days. Outside Dhaka, delivery takes 3-5 business days. Pre-order items ship on their announced launch dates.",
  },
  {
    question: "What is your return policy?",
    answer: "We offer a 7-day hassle-free return policy for unused, unopened products in their original packaging. Skincare and perfume products cannot be returned once opened for hygiene reasons.",
  },
  {
    question: "Do you offer Cash on Delivery?",
    answer: "Yes! We accept Cash on Delivery (COD), bKash, Nagad, Rocket, and credit/debit cards. A small COD fee may apply for orders under ৳2,000.",
  },
  {
    question: "How does pre-ordering work?",
    answer: "Pre-order products are upcoming launches that you can reserve before they arrive. You'll receive a notification when your pre-order item ships. Pre-order items are non-refundable.",
  },
  {
    question: "Is there a loyalty program?",
    answer: "Yes! Every purchase earns you ChineXa Points, which you can redeem for discounts on future orders. Sign up for our newsletter to learn more about exclusive member benefits.",
  },
];

export function FaqSection() {
  return (
    <section className="py-16 bg-white">
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
