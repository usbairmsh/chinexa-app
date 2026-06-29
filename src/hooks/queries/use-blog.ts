"use client";

import { useQuery } from "@tanstack/react-query";
import { services } from "@/services";

export function useBlogPosts(params?: { page?: number; page_size?: number; category?: string }) {
  return useQuery({
    queryKey: ["blog", params],
    queryFn: () => services.blog.getAll(params),
  });
}

export function useBlogPost(slug: string) {
  return useQuery({
    queryKey: ["blog", slug],
    queryFn: () => services.blog.getBySlug(slug),
    enabled: !!slug,
  });
}

export function useRecentPosts(limit = 3) {
  return useQuery({
    queryKey: ["blog", "recent", limit],
    queryFn: () => services.blog.getRecent(limit),
  });
}
