"use client";

import { motion } from "framer-motion";

interface ContentLoaderProps {
  message?: string;
  fullPage?: boolean;
}

export function ContentLoader({ message = "Loading...", fullPage = false }: ContentLoaderProps) {
  return (
    <div className={fullPage ? "fixed inset-0 z-[9998] flex items-center justify-center bg-white/60 backdrop-blur-sm" : "flex items-center justify-center py-16"}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-3"
      >
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-[3px] border-pearl" />
          <div className="absolute inset-0 h-10 w-10 rounded-full border-[3px] border-secondary border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-charcoal-lighter tracking-wide">{message}</p>
      </motion.div>
    </div>
  );
}
