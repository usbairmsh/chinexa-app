"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DeliveryZone {
  id: string;
  name: string;
  areas: string;
  charge: number;
  estimatedDays: string;
  isActive: boolean;
}

export interface DeliveryPartner {
  id: string;
  name: string;
  logo?: string;
  trackingUrl?: string;
  zones: string[];
  isActive: boolean;
}

interface DeliveryState {
  freeDeliveryEnabled: boolean;
  freeDeliveryThreshold: number;
  zones: DeliveryZone[];
  partners: DeliveryPartner[];
  setFreeDelivery: (enabled: boolean) => void;
  setFreeDeliveryThreshold: (amount: number) => void;
  updateZone: (id: string, updates: Partial<DeliveryZone>) => void;
  addZone: (zone: DeliveryZone) => void;
  removeZone: (id: string) => void;
  updatePartner: (id: string, updates: Partial<DeliveryPartner>) => void;
  addPartner: (partner: DeliveryPartner) => void;
  removePartner: (id: string) => void;
  getShippingCost: (subtotal: number, zone?: string) => number;
}

export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set, get) => ({
      freeDeliveryEnabled: true,
      freeDeliveryThreshold: 3000,
      zones: [
        { id: "dhaka-city", name: "Dhaka City", areas: "Gulshan, Banani, Dhanmondi, Uttara, Mirpur, Mohammadpur, Bashundhara, Motijheel, Tejgaon", charge: 60, estimatedDays: "1-2", isActive: true },
        { id: "dhaka-sub", name: "Dhaka Suburbs", areas: "Gazipur, Narayanganj, Savar, Tongi, Keraniganj, Manikganj", charge: 100, estimatedDays: "2-3", isActive: true },
        { id: "chittagong", name: "Chittagong Division", areas: "Chittagong City, Cox's Bazar, Comilla, Feni, Noakhali", charge: 120, estimatedDays: "3-5", isActive: true },
        { id: "rajshahi", name: "Rajshahi Division", areas: "Rajshahi, Bogra, Pabna, Natore, Naogaon", charge: 130, estimatedDays: "3-5", isActive: true },
        { id: "khulna", name: "Khulna Division", areas: "Khulna, Jessore, Satkhira, Kushtia", charge: 130, estimatedDays: "3-5", isActive: true },
        { id: "sylhet", name: "Sylhet Division", areas: "Sylhet, Moulvibazar, Habiganj, Sunamganj", charge: 140, estimatedDays: "4-6", isActive: true },
        { id: "rangpur", name: "Rangpur Division", areas: "Rangpur, Dinajpur, Thakurgaon, Panchagarh", charge: 140, estimatedDays: "4-6", isActive: true },
        { id: "barisal", name: "Barisal Division", areas: "Barisal, Patuakhali, Bhola, Pirojpur", charge: 150, estimatedDays: "4-7", isActive: true },
        { id: "mymensingh", name: "Mymensingh Division", areas: "Mymensingh, Jamalpur, Netrokona, Sherpur", charge: 130, estimatedDays: "3-5", isActive: true },
      ],
      partners: [
        { id: "steadfast", name: "Steadfast Courier", trackingUrl: "https://steadfast.com.bd/track", zones: ["dhaka-city", "dhaka-sub", "chittagong", "rajshahi", "khulna", "sylhet", "rangpur", "barisal", "mymensingh"], isActive: true },
        { id: "pathao", name: "Pathao Courier", trackingUrl: "https://pathao.com/track", zones: ["dhaka-city", "dhaka-sub", "chittagong"], isActive: true },
        { id: "redx", name: "RedX", trackingUrl: "https://redx.com.bd/track", zones: ["dhaka-city", "dhaka-sub", "chittagong", "rajshahi", "khulna"], isActive: true },
        { id: "sundarban", name: "Sundarban Courier", trackingUrl: "https://sundarbanbd.com/track", zones: ["dhaka-city", "dhaka-sub", "chittagong", "rajshahi", "khulna", "sylhet", "rangpur", "barisal", "mymensingh"], isActive: false },
        { id: "paperfly", name: "Paperfly", trackingUrl: "https://paperfly.com.bd/track", zones: ["dhaka-city", "dhaka-sub"], isActive: false },
      ],

      setFreeDelivery: (enabled) => set({ freeDeliveryEnabled: enabled }),
      setFreeDeliveryThreshold: (amount) => set({ freeDeliveryThreshold: amount }),

      updateZone: (id, updates) => set((s) => ({ zones: s.zones.map((z) => z.id === id ? { ...z, ...updates } : z) })),
      addZone: (zone) => set((s) => ({ zones: [...s.zones, zone] })),
      removeZone: (id) => set((s) => ({ zones: s.zones.filter((z) => z.id !== id) })),

      updatePartner: (id, updates) => set((s) => ({ partners: s.partners.map((p) => p.id === id ? { ...p, ...updates } : p) })),
      addPartner: (partner) => set((s) => ({ partners: [...s.partners, partner] })),
      removePartner: (id) => set((s) => ({ partners: s.partners.filter((p) => p.id !== id) })),

      getShippingCost: (subtotal, zone = "dhaka-city") => {
        const state = get();
        if (state.freeDeliveryEnabled && subtotal >= state.freeDeliveryThreshold) return 0;
        const z = state.zones.find((z) => z.id === zone);
        return z?.charge || 120;
      },
    }),
    { name: "chinexa-delivery" }
  )
);
