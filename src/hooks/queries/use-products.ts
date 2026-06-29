"use client";

import { useQuery } from "@tanstack/react-query";
import { services } from "@/services";
import type { ProductListParams } from "@/types/product";

export function useProducts(params?: ProductListParams) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: () => services.products.getAll(params),
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: () => services.products.getBySlug(slug),
    enabled: !!slug,
  });
}

export function useProductsByCategory(categorySlug: string, params?: ProductListParams) {
  return useQuery({
    queryKey: ["products", "category", categorySlug, params],
    queryFn: () => services.products.getByCategory(categorySlug, params),
    enabled: !!categorySlug,
  });
}

export function useRelatedProducts(productId: string) {
  return useQuery({
    queryKey: ["products", "related", productId],
    queryFn: () => services.products.getRelated(productId),
    enabled: !!productId,
  });
}

export function useFeaturedProducts(limit = 8) {
  return useQuery({
    queryKey: ["products", "featured", limit],
    queryFn: () => services.products.getFeatured(limit),
  });
}

export function useNewArrivals(limit = 8) {
  return useQuery({
    queryKey: ["products", "new-arrivals", limit],
    queryFn: () => services.products.getNewArrivals(limit),
  });
}

export function useBestsellers(limit = 8) {
  return useQuery({
    queryKey: ["products", "bestsellers", limit],
    queryFn: () => services.products.getBestsellers(limit),
  });
}

export function useTrendingProducts(limit = 8) {
  return useQuery({
    queryKey: ["products", "trending", limit],
    queryFn: () => services.products.getTrending(limit),
  });
}

export function usePreorderProducts(limit = 8) {
  return useQuery({
    queryKey: ["products", "preorders", limit],
    queryFn: () => services.products.getPreorders(limit),
  });
}

export function useSearchProducts(query: string, params?: ProductListParams) {
  return useQuery({
    queryKey: ["products", "search", query, params],
    queryFn: () => services.products.search(query, params),
    enabled: query.length >= 2,
  });
}
