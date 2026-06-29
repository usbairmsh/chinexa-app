"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "./query-provider";
import { ToastProviderWrapper } from "./toast-provider";
import { LenisProvider } from "./lenis-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <TooltipProvider>
        <LenisProvider>
          <ToastProviderWrapper>
            {children}
          </ToastProviderWrapper>
        </LenisProvider>
      </TooltipProvider>
    </QueryProvider>
  );
}
