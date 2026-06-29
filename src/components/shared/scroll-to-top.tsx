"use client";

import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => setVisible(window.scrollY > 500);
    // Listen on both scroll and Lenis virtual scroll
    window.addEventListener("scroll", check, { passive: true });
    document.addEventListener("scroll", check, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", check);
      document.removeEventListener("scroll", check, { capture: true });
    };
  }, []);

  const scrollToTop = () => {
    // Force scroll to top — works with or without Lenis
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 group flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-border/40 text-charcoal shadow-[0_4px_24px_rgba(0,0,0,0.1)] hover:bg-charcoal hover:text-white hover:border-charcoal hover:shadow-[0_6px_30px_rgba(0,0,0,0.2)] transition-all duration-300 cursor-pointer"
          aria-label="Scroll to top"
        >
          <ChevronUp className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
