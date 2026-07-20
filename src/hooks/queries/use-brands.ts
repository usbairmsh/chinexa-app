"use client";

import { useQuery } from "@tanstack/react-query";
import type { Brand } from "@/lib/brands";

export function useBrand(slug: string) {
  return useQuery({
    queryKey: ["brand", slug],
    queryFn: async (): Promise<Brand | null> => {
      const res = await fetch(`/api/brands/${slug}`);
      const data = await res.json();
      return data && !data.error ? data : null;
    },
    enabled: !!slug,
  });
}
