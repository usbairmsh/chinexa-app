"use client";

import { useQuery } from "@tanstack/react-query";
import { services } from "@/services";
import type { Banner } from "@/types/banner";

export function useBanners(position?: Banner["position"]) {
  return useQuery({
    queryKey: ["banners", position],
    queryFn: () => (position ? services.banners.getByPosition(position) : services.banners.getAll()),
  });
}
