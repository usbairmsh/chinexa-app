"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2, Check } from "lucide-react";
import Link from "next/link";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Store info
  const [storeName, setStoreName] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeAddress, setStoreAddress] = useState("");

  // Features
  const [features, setFeatures] = useState<Record<string, boolean>>({
    product_reviews: true,
    wishlist: true,
    compare_products: true,
    preorders: true,
    guest_checkout: true,
  });

  useEffect(() => {
    fetch("/api/settings?keys=store_name,store_email,store_phone,store_address,features")
      .then((r) => r.json())
      .then((data) => {
        if (data.store_name) setStoreName(data.store_name);
        if (data.store_email) setStoreEmail(data.store_email);
        if (data.store_phone) setStorePhone(data.store_phone);
        if (data.store_address) setStoreAddress(data.store_address);
        if (data.features && typeof data.features === "object") setFeatures((prev) => ({ ...prev, ...data.features }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleFeature = (key: string) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = {
        store_name: storeName,
        store_email: storeEmail,
        store_phone: storePhone,
        store_address: storeAddress,
        features,
      };
      // Save each setting
      for (const [key, value] of Object.entries(settings)) {
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value: typeof value === "string" ? value : value }),
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {} finally { setSaving(false); }
  };

  const featureList = [
    { key: "product_reviews", label: "Product Reviews", desc: "Allow customers to leave reviews" },
    { key: "wishlist", label: "Wishlist", desc: "Allow customers to save products" },
    { key: "compare_products", label: "Compare Products", desc: "Allow side-by-side comparison" },
    { key: "preorders", label: "Pre-orders", desc: "Accept pre-orders for upcoming products" },
    { key: "guest_checkout", label: "Guest Checkout", desc: "Allow checkout without an account" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 text-secondary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Settings</h1>
          <p className="text-sm text-charcoal-lighter">Manage your store settings</p>
        </div>
        <AdminButton onClick={handleSave} disabled={saving} className={saved ? "!bg-success hover:!bg-success" : ""}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
        </AdminButton>
      </div>

      <div className="flex gap-3 text-sm">
        <Link href="/admin/settings" className="px-3 py-1.5 rounded-lg bg-primary-light text-charcoal font-medium">General</Link>
        <Link href="/admin/settings/store" className="px-3 py-1.5 rounded-lg hover:bg-pearl text-charcoal-lighter transition-colors">Store</Link>
        <Link href="/admin/settings/delivery" className="px-3 py-1.5 rounded-lg hover:bg-pearl text-charcoal-lighter transition-colors font-medium text-secondary">Delivery</Link>
        <Link href="/admin/settings/payment" className="px-3 py-1.5 rounded-lg hover:bg-pearl text-charcoal-lighter transition-colors">Payment</Link>
        <Link href="/admin/settings/notifications" className="px-3 py-1.5 rounded-lg hover:bg-pearl text-charcoal-lighter transition-colors">Notifications</Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Store Information</CardTitle>
          <CardDescription>Basic information about your store</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input label="Store Name" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="ChineXa" />
          <Input label="Contact Email" value={storeEmail} onChange={(e) => setStoreEmail(e.target.value)} placeholder="hello@chinexa.com" type="email" />
          <Input label="Contact Phone" value={storePhone} onChange={(e) => setStorePhone(e.target.value)} placeholder="+880 1700-000000" />
          <Textarea label="Store Address" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} placeholder="Gulshan-2, Dhaka, Bangladesh" />
          <Input label="Currency" value="BDT (৳)" disabled />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Features</CardTitle>
          <CardDescription>Enable or disable store features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {featureList.map((feature) => (
            <div key={feature.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-charcoal">{feature.label}</p>
                <p className="text-xs text-charcoal-lighter">{feature.desc}</p>
              </div>
              <Switch checked={features[feature.key] ?? true} onCheckedChange={() => toggleFeature(feature.key)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
