"use client";

import { ToastProvider as RadixToastProvider, ToastViewport } from "@/components/ui/toast";
import type { ReactNode } from "react";

export function ToastProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <RadixToastProvider>
      {children}
      <ToastViewport />
    </RadixToastProvider>
  );
}
