"use client";

import { useQuery } from "@tanstack/react-query";

interface TrendingSearchesResponse {
  terms: string[];
  source: "search_activity" | "bestsellers";
}

export function useTrendingSearches() {
  return useQuery({
    queryKey: ["search", "trending"],
    queryFn: async (): Promise<TrendingSearchesResponse> => {
      const res = await fetch("/api/search/trending");
      if (!res.ok) throw new Error("Failed to load trending searches");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
