"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const faqSections = [
  {
    title: "Ordering & Payment",
    faqs: [
      { q: "What payment methods do you accept?", a: "We accept Cash on Delivery (COD), bKash, Nagad, Rocket, and credit/debit cards (Visa, Mastercard). For mobile payments, please send the amount and include the transaction ID at checkout." },
      { q: "Is there a minimum order value?", a: "There is no minimum order value. However, orders above ৳3,000 qualify for free standard shipping." },
      { q: "Can I cancel my order?", a: "You can cancel your order within 1 hour of placing it by contacting our support team. After that, the order enters processing and cannot be cancelled." },
      { q: "Do you offer Cash on Delivery?", a: "Yes! COD is available across Bangladesh. A small COD fee of ৳30 may apply for orders under ৳2,000." },
    ],
  },
  {
    title: "Shipping & Delivery",
    faqs: [
      { q: "How long does delivery take?", a: "Standard delivery within Dhaka takes 1-2 business days. Outside Dhaka, delivery takes 3-5 business days. Express delivery (1 business day within Dhaka) is available for an additional ৳200." },
      { q: "Do you deliver outside Dhaka?", a: "Yes, we deliver across all 8 divisions of Bangladesh. Delivery charges vary by location — orders above ৳3,000 get free standard shipping." },
      { q: "How can I track my order?", a: "Once your order is shipped, you'll receive a tracking link via SMS. You can also track your order on our Track Order page using your order number." },
      { q: "What if my package is damaged during delivery?", a: "Please contact us within 24 hours of delivery with photos of the damaged package. We'll arrange a replacement or full refund." },
    ],
  },
  {
    title: "Products & Authenticity",
    faqs: [
      { q: "Are all products authentic?", a: "Yes, every product sold on ChineXa is 100% authentic. We source directly from authorized distributors and brands in Korea, Japan, France, Italy, USA, and UK. We never sell replicas or counterfeit products." },
      { q: "What is your return policy?", a: "We offer a 7-day hassle-free return policy for unused, unopened products in their original packaging. Skincare and perfume products cannot be returned once opened for hygiene reasons." },
      { q: "How do I know if a product is right for my skin?", a: "Each product page includes detailed ingredient lists, skin type recommendations, and how-to-use instructions. You can also contact our beauty advisors via WhatsApp for personalized recommendations." },
      { q: "How does pre-ordering work?", a: "Pre-order products are upcoming launches you can reserve before they arrive. You'll be charged at the time of pre-order, and we'll notify you when it ships. Pre-order items are non-refundable." },
    ],
  },
  {
    title: "Account & Support",
    faqs: [
      { q: "How do I create an account?", a: "We don't require a separate registration step. Simply enter your phone number, verify with OTP, and you're in! Your account is automatically created when you first log in or make a purchase." },
      { q: "How do I contact customer support?", a: "You can reach us via WhatsApp at +880 1700-000000 (fastest), email at hello@chinexa.com, or through the Contact Us page. Our support hours are Saturday–Thursday, 10AM–8PM." },
      { q: "How do I get help from an agent?", a: "Click the chat icon at the bottom-left of any page, or use \"Get Help\" in the footer or your account dashboard, to open a live chat with our support team. You don't need an account to use it — just start typing and we'll reply as soon as possible." },
      { q: "I forgot my account. How do I log in?", a: "We use phone-based login with OTP verification — no passwords to remember. Just enter your phone number on the login page, receive an OTP, and you're in." },
    ],
  },
];

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
