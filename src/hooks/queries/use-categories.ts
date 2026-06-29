"use client";

import { useQuery } from "@tanstack/react-query";
import { services } from "@/services";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => services.categories.getAll(),
  });
}

export function useCategory(slug: string) {
  return useQuery({
    queryKey: ["category", slug],
    queryFn: () => services.categories.getBySlug(slug),
    enabled: !!slug,
  });
}
