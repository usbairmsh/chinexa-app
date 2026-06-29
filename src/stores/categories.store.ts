"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Category } from "@/types/category";
import { slugify, randomId } from "@/lib/utils";

interface CategoriesState {
  customCategories: Category[];
  hiddenSeedIds: string[];
  categoryOrder: string[]; // ordered list of all category ids (seed + custom)
  addCategory: (data: { name: string; slug: string; description: string; image: string }) => Category;
  removeCategory: (id: string) => void;
  toggleCategory: (id: string) => void;
  toggleSeedCategory: (id: string) => void;
  isSeedHidden: (id: string) => boolean;
  reorderCategories: (orderedIds: string[]) => void;
}

export const useCategoriesStore = create<CategoriesState>()(
  persist(
    (set, get) => ({
      customCategories: [],
      hiddenSeedIds: [],
      categoryOrder: [],

      addCategory: (data) => {
        const category: Category = {
          id: `custom-${randomId()}`,
          name: data.name,
          slug: data.slug || slugify(data.name),
          description: data.description,
          image: data.image || `https://picsum.photos/seed/${slugify(data.name)}/600/400`,
          order: 100 + get().customCategories.length,
          is_active: true,
          product_count: 0,
          created_at: new Date().toISOString(),
        };
        set((state) => ({
          customCategories: [...state.customCategories, category],
          categoryOrder: [...state.categoryOrder, category.id],
        }));
        return category;
      },

      removeCategory: (id) => {
        set((state) => ({
          customCategories: state.customCategories.filter((c) => c.id !== id),
          categoryOrder: state.categoryOrder.filter((i) => i !== id),
        }));
      },

      toggleCategory: (id) => {
        set((state) => ({
          customCategories: state.customCategories.map((c) =>
            c.id === id ? { ...c, is_active: !c.is_active } : c
          ),
        }));
      },

      toggleSeedCategory: (id) => {
        set((state) => ({
          hiddenSeedIds: state.hiddenSeedIds.includes(id)
            ? state.hiddenSeedIds.filter((i) => i !== id)
            : [...state.hiddenSeedIds, id],
        }));
      },

      isSeedHidden: (id) => get().hiddenSeedIds.includes(id),

      reorderCategories: (orderedIds) => {
        set({ categoryOrder: orderedIds });
      },
    }),
    { name: "chinexa-custom-categories" }
  )
);
