"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Check, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AdminButton } from "@/components/admin/shared/admin-button";

interface PaymentMethod {
  id: string;
  name: string;
  enabled: boolean;
  account_number: string;
  instructions: string;
}

export default function PaymentSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [methods, setMethods] = useState<PaymentMethod[]>([
    { id: "cod", name: "Cash on Delivery", enabled: true, account_number: "", instructions: "Pay when you receive your order" },
    { id: "bkash", name: "bKash", enabled: true, account_number: "", instructions: "Send payment to the bKash number below" },
    { id: "nagad", name: "Nagad", enabled: true, account_number: "", instructions: "Send payment to the Nagad number below" },
    { id: "rocket", name: "Rocket", enabled: false, account_number: "", instructions: "Send payment to the Rocket number below" },
    { id: "card", name: "Card Payment", enabled: false, account_number: "", instructions: "Pay securely with your credit/debit card" },
  ]);

  useEffect(() => {
    fetch("/api/settings?key=payment_methods")
      .then((r) => r.json())
      .then((data) => {
        if (data?.value && Array.isArray(data.value)) setMethods(data.value);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateMethod = (id: string, field: keyof PaymentMethod, value: string | boolean) => {
    setMethods((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "payment_methods", value: methods }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch {} finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/settings" className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-charcoal">Payment Methods</h1>
            <p className="text-xs text-charcoal-lighter">Configure accepted payment methods</p>
          </div>
        </div>
        <AdminButton onClick={handleSave} disabled={saving} className={saved ? "!bg-success hover:!bg-success" : ""}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {saved ? "Saved!" : "Save"}
        </AdminButton>
      </div>

      {methods.map((method) => (
        <Card key={method.id} className={!method.enabled ? "opacity-60" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-secondary" /> {method.name}
              </CardTitle>
              <Switch checked={method.enabled} onCheckedChange={(v) => updateMethod(method.id, "enabled", v)} />
            </div>
          </CardHeader>
          {method.enabled && method.id !== "cod" && (
            <CardContent className="space-y-3">
              <Input label="Account / Phone Number" value={method.account_number} onChange={(e) => updateMethod(method.id, "account_number", e.target.value)} placeholder={method.id === "card" ? "Payment gateway details" : "01XXXXXXXXX"} />
              <Input label="Instructions" value={method.instructions} onChange={(e) => updateMethod(method.id, "instructions", e.target.value)} placeholder="Payment instructions for customers" />
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
