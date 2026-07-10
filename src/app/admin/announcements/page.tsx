"use client";

import { useState, useEffect } from "react";
import {
  Megaphone, Type, Timer, Truck, Star, Plus, Trash2, Save, Loader2, Check,
  ChevronUp, ChevronDown, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { cn, randomId } from "@/lib/utils";
import {
  DEFAULT_ANNOUNCEMENT_CONFIG,
  type Announcement, type AnnouncementConfig, type AnnouncementType,
} from "@/types/announcement";

const TYPE_META: Record<AnnouncementType, { label: string; description: string; icon: typeof Type }> = {
  text: { label: "Text / Info", description: "A simple message, e.g. a shipping policy or a store note", icon: Type },
  countdown: { label: "Countdown / Sale", description: "A live countdown to a sale deadline", icon: Timer },
  free_shipping: { label: "Free Shipping", description: "Message tied to your real free-delivery threshold", icon: Truck },
  social_proof: { label: "Social Proof", description: "e.g. a rating or customer count", icon: Star },
};

function makeDefault(type: AnnouncementType): Announcement {
  const base = { id: randomId(), enabled: true };
  switch (type) {
    case "text": return { ...base, type, message: "" };
    case "countdown": return { ...base, type, label: "SALE ENDS IN", endsAt: "", onExpire: "hide" };
    case "free_shipping": return { ...base, type, messageTemplate: "Free shipping on orders over {threshold}!" };
    case "social_proof": return { ...base, type, message: "" };
  }
}

function AnnouncementEditor({ item, onChange }: { item: Announcement; onChange: (patch: Partial<Announcement>) => void }) {
  if (item.type === "text") {
    return <Input value={item.message} onChange={(e) => onChange({ message: e.target.value } as Partial<Announcement>)} placeholder="Free delivery on orders over ৳3,000" />;
  }
  if (item.type === "social_proof") {
    return <Input value={item.message} onChange={(e) => onChange({ message: e.target.value } as Partial<Announcement>)} placeholder="⭐ 4.9/5 from 2,000+ happy customers" />;
  }
  if (item.type === "free_shipping") {
    return (
      <div className="space-y-1.5">
        <Input value={item.messageTemplate} onChange={(e) => onChange({ messageTemplate: e.target.value } as Partial<Announcement>)} placeholder="Free shipping on orders over {threshold}!" />
        <p className="text-[11px] text-charcoal-lighter">Use <code className="px-1 py-0.5 rounded bg-pearl">{"{threshold}"}</code> — it&apos;s replaced with your real free-delivery threshold from Delivery settings.</p>
      </div>
    );
  }
  // countdown
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Input label="Label" value={item.label} onChange={(e) => onChange({ label: e.target.value } as Partial<Announcement>)} placeholder="SUMMER SALE ENDS IN" />
      <Input label="Ends At" type="datetime-local" value={item.endsAt} onChange={(e) => onChange({ endsAt: e.target.value } as Partial<Announcement>)} />
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-charcoal-light mb-1.5">When it expires</label>
        <Select value={item.onExpire} onValueChange={(v) => onChange({ onExpire: v as "hide" | "keep_showing_zero" } as Partial<Announcement>)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hide">Hide this announcement</SelectItem>
            <SelectItem value="keep_showing_zero">Keep showing 00:00:00:00</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default function AdminAnnouncementsPage() {
  const [config, setConfig] = useState<AnnouncementConfig>(DEFAULT_ANNOUNCEMENT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addType, setAddType] = useState<AnnouncementType>("text");

  useEffect(() => {
    fetch("/api/settings?key=announcements")
      .then((r) => r.json())
      .then((data) => { if (data?.value) setConfig({ ...DEFAULT_ANNOUNCEMENT_CONFIG, ...data.value }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addItem = () => {
    setConfig((c) => ({ ...c, items: [...c.items, makeDefault(addType)] }));
  };

  const updateItem = (id: string, patch: Partial<Announcement>) => {
    setConfig((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? ({ ...i, ...patch } as Announcement) : i)) }));
  };

  const removeItem = (id: string) => {
    setConfig((c) => ({ ...c, items: c.items.filter((i) => i.id !== id) }));
  };

  const moveItem = (id: string, direction: "up" | "down") => {
    setConfig((c) => {
      const idx = c.items.findIndex((i) => i.id === id);
      if ((direction === "up" && idx <= 0) || (direction === "down" && idx >= c.items.length - 1)) return c;
      const next = [...c.items];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return { ...c, items: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "announcements", value: config }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {} finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-secondary" /> Announcements
          </h1>
          <p className="text-sm text-charcoal-lighter mt-1">The top bar shown on every storefront page. Add one or more — if more than one is enabled, they rotate automatically.</p>
        </div>
        <AdminButton onClick={handleSave} disabled={saving} className={cn(saved && "!bg-success hover:!bg-success")}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
        </AdminButton>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rotation</CardTitle>
          <CardDescription>How long each announcement shows before switching to the next one (only matters with 2+ enabled)</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="number"
            min={3}
            className="w-32"
            value={config.rotateSeconds}
            onChange={(e) => setConfig((c) => ({ ...c, rotateSeconds: Math.max(3, Number(e.target.value) || 3) }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Announcement</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Select value={addType} onValueChange={(v) => setAddType(v as AnnouncementType)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_META) as AnnouncementType[]).map((t) => (
                <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AdminButton variant="outline" onClick={addItem}><Plus className="h-3.5 w-3.5" /> Add</AdminButton>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {config.items.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-charcoal-lighter">
            No announcements yet — the top bar stays hidden on your storefront until you add one.
          </CardContent></Card>
        )}

        {config.items.map((item, i) => {
          const meta = TYPE_META[item.type];
          const Icon = meta.icon;
          return (
            <Card key={item.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light shrink-0"><Icon className="h-4 w-4 text-secondary" /></div>
                  <div>
                    <CardTitle className="text-sm">{meta.label}</CardTitle>
                    <CardDescription className="text-xs">{meta.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveItem(item.id, "up")} disabled={i === 0} className="p-1.5 rounded-md text-charcoal-lighter/60 hover:text-charcoal hover:bg-pearl disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => moveItem(item.id, "down")} disabled={i === config.items.length - 1} className="p-1.5 rounded-md text-charcoal-lighter/60 hover:text-charcoal hover:bg-pearl disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <Switch checked={item.enabled} onCheckedChange={(v) => updateItem(item.id, { enabled: v })} />
                  <button onClick={() => removeItem(item.id)} className="p-1.5 rounded-md text-charcoal-lighter/50 hover:text-destructive hover:bg-destructive/5 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <AnnouncementEditor item={item} onChange={(patch) => updateItem(item.id, patch)} />
                <div className="flex items-center gap-1.5 text-xs text-charcoal-lighter">
                  <ExternalLink className="h-3 w-3" />
                  <Input
                    value={item.link || ""}
                    onChange={(e) => updateItem(item.id, { link: e.target.value })}
                    placeholder="Link when clicked (optional), e.g. /products?category=sale"
                    className="h-8 text-xs"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
