"use client";

import { useState, useEffect } from "react";

export interface StoreSettings {
  store_name: string;
  store_email: string;
  store_phone: string;
  store_address: string;
  social_links: { platform: string; url: string }[];
  free_delivery_threshold: number;
  free_delivery_enabled: boolean;
  payment_methods: { id: string; name: string; enabled: boolean; account_number: string; instructions: string; qr_image: string; icon?: string; input_type?: "transaction_id" | "phone_number" }[];
  /** Store `preorders` feature toggle — when off, out-of-stock badged products behave as plain out-of-stock (wishlist-only). Defaults to true. */
  preorders_enabled: boolean;
}

const defaults: StoreSettings = {
  store_name: "ChineXa",
  store_email: "hello@chinexa.com",
  store_phone: "+880 1700-000000",
  store_address: "Dhaka, Bangladesh",
  social_links: [],
  free_delivery_threshold: 3000,
  free_delivery_enabled: true,
  payment_methods: [],
  preorders_enabled: true,
};

let cachedSettings: StoreSettings | null = null;
let fetchPromise: Promise<StoreSettings> | null = null;

async function loadSettings(): Promise<StoreSettings> {
  if (cachedSettings) return cachedSettings;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch("/api/settings?keys=store_name,store_email,store_phone,store_address,social_links,free_delivery_threshold,free_delivery_enabled,payment_methods,features")
    .then((r) => r.json())
    .then((data) => {
      const features = (data.features && typeof data.features === "object") ? data.features as Record<string, unknown> : {};
      const s: StoreSettings = {
        store_name: data.store_name || defaults.store_name,
        store_email: data.store_email || defaults.store_email,
        store_phone: data.store_phone || defaults.store_phone,
        store_address: data.store_address || defaults.store_address,
        social_links: Array.isArray(data.social_links) ? data.social_links : (() => {
          // Convert old object format
          if (data.social_links && typeof data.social_links === "object") {
            return Object.entries(data.social_links).filter(([, v]) => v).map(([k, v]) => ({ platform: k, url: v as string }));
          }
          return defaults.social_links;
        })(),
        free_delivery_threshold: Number(data.free_delivery_threshold) || defaults.free_delivery_threshold,
        free_delivery_enabled: data.free_delivery_enabled !== undefined ? !!data.free_delivery_enabled : defaults.free_delivery_enabled,
        payment_methods: Array.isArray(data.payment_methods) ? data.payment_methods : defaults.payment_methods,
        preorders_enabled: typeof features.preorders === "boolean" ? features.preorders : defaults.preorders_enabled,
      };
      cachedSettings = s;
      return s;
    })
    .catch(() => defaults);

  return fetchPromise;
}

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(cachedSettings || defaults);
  const [loaded, setLoaded] = useState(!!cachedSettings);

  useEffect(() => {
    loadSettings().then((s) => { setSettings(s); setLoaded(true); });
  }, []);

  return { ...settings, loaded };
}
