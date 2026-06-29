"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-charcoal">Settings</h1>
        <p className="text-sm text-charcoal-lighter">Manage your store settings</p>
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
          <Input label="Store Name" defaultValue="ChineXa" />
          <Input label="Contact Email" defaultValue="hello@chinexa.com" />
          <Input label="Contact Phone" defaultValue="+880 1700-000000" />
          <Textarea label="Store Address" defaultValue="Gulshan-2, Dhaka, Bangladesh" />
          <Input label="Currency" defaultValue="BDT (৳)" disabled />
          <AdminButton>Save Changes</AdminButton>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Features</CardTitle>
          <CardDescription>Enable or disable store features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Product Reviews", desc: "Allow customers to leave reviews", enabled: true },
            { label: "Wishlist", desc: "Allow customers to save products", enabled: true },
            { label: "Compare Products", desc: "Allow side-by-side comparison", enabled: true },
            { label: "Pre-orders", desc: "Accept pre-orders for upcoming products", enabled: true },
            { label: "Guest Checkout", desc: "Allow checkout without an account", enabled: true },
          ].map((feature) => (
            <div key={feature.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-charcoal">{feature.label}</p>
                <p className="text-xs text-charcoal-lighter">{feature.desc}</p>
              </div>
              <Switch defaultChecked={feature.enabled} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
