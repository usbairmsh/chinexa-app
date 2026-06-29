"use client";

import { motion } from "framer-motion";
import { Phone, Mail, MapPin, Clock, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumb } from "@/components/ui/breadcrumb";

const contactInfo = [
  { icon: Phone, label: "Phone", value: "+880 1700-000000", href: "tel:+8801700000000" },
  { icon: MessageCircle, label: "WhatsApp", value: "+880 1700-000000", href: "https://wa.me/8801700000000" },
  { icon: Mail, label: "Email", value: "hello@chinexa.com", href: "mailto:hello@chinexa.com" },
  { icon: MapPin, label: "Address", value: "Gulshan-2, Dhaka 1212, Bangladesh", href: "#" },
  { icon: Clock, label: "Hours", value: "Sat–Thu: 10AM–8PM", href: "#" },
];

export default function ContactPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="bg-hero-gradient py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={[{ label: "Contact Us" }]} />
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-semibold text-charcoal mt-4">
            Get in Touch
          </h1>
          <p className="text-charcoal-lighter mt-3 max-w-lg">
            We&apos;d love to hear from you. Reach out with any questions, feedback, or just to say hello.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-5 gap-10">
          {/* Contact Info */}
          <div className="lg:col-span-2 space-y-4">
            {contactInfo.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <a href={item.href} className="group">
                  <Card className="hover:shadow-card-hover transition-shadow">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light group-hover:bg-secondary/10 transition-colors">
                        <item.icon className="h-5 w-5 text-secondary" />
                      </div>
                      <div>
                        <p className="text-xs text-charcoal-lighter">{item.label}</p>
                        <p className="text-sm font-medium text-charcoal">{item.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                </a>
              </motion.div>
            ))}
          </div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-3"
          >
            <Card>
              <CardContent className="p-6 sm:p-8">
                <h2 className="font-heading text-xl font-semibold text-charcoal mb-6">Send us a Message</h2>
                <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input label="Your Name" placeholder="Fatima Akter" />
                    <Input label="Phone Number" placeholder="01XXXXXXXXX" type="tel" />
                  </div>
                  <Input label="Email (Optional)" placeholder="you@example.com" type="email" />
                  <Input label="Subject" placeholder="How can we help?" />
                  <Textarea label="Message" placeholder="Tell us more..." className="min-h-[140px]" />
                  <Button variant="secondary" size="lg" type="submit">
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
