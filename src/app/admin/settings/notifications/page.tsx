"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Check, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AdminButton } from "@/components/admin/shared/admin-button";

export default function NotificationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    order_placed: true,
    order_confirmed: true,
    order_shipped: true,
    order_delivered: true,
    order_cancelled: true,
    return_requested: true,
    return_approved: true,
    low_stock_alert: true,
    new_review: true,
    new_customer: true,
    points_earned: true,
    promo_offers: false,
  });

  useEffect(() => {
    fetch("/api/settings?key=notification_settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.value && typeof data.value === "object") setNotifications((prev) => ({ ...prev, ...data.value }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: string) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "notification_settings", value: notifications }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch {} finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;

  const sections = [
    {
      title: "Order Notifications", desc: "Notify customers about order updates",
      items: [
        { key: "order_placed", label: "Order Placed", desc: "When a new order is placed" },
        { key: "order_confirmed", label: "Order Confirmed", desc: "When an order is confirmed" },
        { key: "order_shipped", label: "Order Shipped", desc: "When an order is shipped" },
        { key: "order_delivered", label: "Order Delivered", desc: "When an order is delivered" },
        { key: "order_cancelled", label: "Order Cancelled", desc: "When an order is cancelled" },
      ],
    },
    {
      title: "Return Notifications", desc: "Notify about return requests",
      items: [
        { key: "return_requested", label: "Return Requested", desc: "When a customer requests a return" },
        { key: "return_approved", label: "Return Approved/Rejected", desc: "When a return is processed" },
      ],
    },
    {
      title: "Admin Alerts", desc: "Internal alerts for store management",
      items: [
        { key: "low_stock_alert", label: "Low Stock Alert", desc: "When product stock falls below minimum" },
        { key: "new_review", label: "New Review", desc: "When a customer leaves a review" },
        { key: "new_customer", label: "New Customer Registration", desc: "When a new customer signs up" },
      ],
    },
    {
      title: "Marketing", desc: "Promotional notifications",
      items: [
        { key: "points_earned", label: "Loyalty Points Earned", desc: "When a customer earns loyalty points" },
        { key: "promo_offers", label: "Promotional Offers", desc: "Send promotional offers to customers" },
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/settings" className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-charcoal">Notification Settings</h1>
            <p className="text-xs text-charcoal-lighter">Configure which notifications are sent</p>
          </div>
        </div>
        <AdminButton onClick={handleSave} disabled={saving} className={saved ? "!bg-success hover:!bg-success" : ""}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {saved ? "Saved!" : "Save"}
        </AdminButton>
      </div>

      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4 text-secondary" /> {section.title}</CardTitle>
            <CardDescription>{section.desc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-charcoal">{item.label}</p>
                  <p className="text-xs text-charcoal-lighter">{item.desc}</p>
                </div>
                <Switch checked={notifications[item.key] ?? true} onCheckedChange={() => toggle(item.key)} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
