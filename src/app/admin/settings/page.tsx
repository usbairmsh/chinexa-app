"use client";

import { useState, useEffect } from "react";
import {
  Settings, Store, Truck, CreditCard, Bell, Save, Loader2, Check,
  Plus, Trash2, X
} from "lucide-react";
import { SOCIAL_PLATFORMS, getPlatform } from "@/lib/social-platforms";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { ImageUpload } from "@/components/admin/shared/image-upload";
import { useDeliveryStore } from "@/stores/delivery.store";
import { formatCurrency, cn, randomId } from "@/lib/utils";

type Tab = "general" | "store" | "delivery" | "payment" | "notifications";

const tabList: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "store", label: "Store", icon: Store },
  { id: "delivery", label: "Delivery", icon: Truck },
  { id: "payment", label: "Payment", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
];

interface PaymentMethod {
  id: string; name: string; enabled: boolean; account_number: string; instructions: string;
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [loading, setLoading] = useState(true);

  // ═══ GENERAL ═══
  const [storeName, setStoreName] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [features, setFeatures] = useState<Record<string, boolean>>({
    product_reviews: true, wishlist: true, compare_products: true, preorders: true, guest_checkout: true,
  });
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);

  // ═══ STORE ═══
  const [storeLogo, setStoreLogo] = useState("");
  const [storeTagline, setStoreTagline] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [socialLinks, setSocialLinks] = useState<{ platform: string; url: string }[]>([]);
  const [addSocialOpen, setAddSocialOpen] = useState(false);
  const [newSocialPlatform, setNewSocialPlatform] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const [storeSaving, setStoreSaving] = useState(false);
  const [storeSaved, setStoreSaved] = useState(false);

  // ═══ DELIVERY ═══
  const delivery = useDeliveryStore();
  const [mounted, setMounted] = useState(false);
  const [thresholdInput, setThresholdInput] = useState("");
  const [zoneDialog, setZoneDialog] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [zoneAreas, setZoneAreas] = useState("");
  const [zoneCharge, setZoneCharge] = useState("");
  const [zoneDays, setZoneDays] = useState("");
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [deliverySaved, setDeliverySaved] = useState(false);

  // ═══ PAYMENT ═══
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { id: "COD", name: "Cash on Delivery", enabled: true, account_number: "", instructions: "Pay when you receive" },
    { id: "bkash", name: "bKash", enabled: true, account_number: "", instructions: "" },
    { id: "nagad", name: "Nagad", enabled: true, account_number: "", instructions: "" },
    { id: "rocket", name: "Rocket", enabled: false, account_number: "", instructions: "" },
    { id: "card", name: "Card Payment", enabled: false, account_number: "", instructions: "" },
  ]);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);

  // ═══ NOTIFICATIONS ═══
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    order_placed: true, order_confirmed: true, order_shipped: true, order_delivered: true, order_cancelled: true,
    return_requested: true, return_approved: true, low_stock_alert: true, new_review: true, new_customer: true,
    points_earned: true, promo_offers: false,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // ═══ LOAD ALL ═══
  useEffect(() => {
    setMounted(true);
    fetch("/api/settings?keys=store_name,store_email,store_phone,store_address,features,store_logo,store_tagline,about_text,social_links,maintenance_mode,announcement,delivery_config,payment_methods,notification_settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.store_name) setStoreName(data.store_name);
        if (data.store_email) setStoreEmail(data.store_email);
        if (data.store_phone) setStorePhone(data.store_phone);
        if (data.store_address) setStoreAddress(data.store_address);
        if (data.features) setFeatures((p) => ({ ...p, ...data.features }));
        if (data.store_logo) setStoreLogo(data.store_logo);
        if (data.store_tagline) setStoreTagline(data.store_tagline);
        if (data.about_text) setAboutText(data.about_text);
        if (data.social_links) {
          if (Array.isArray(data.social_links)) {
            setSocialLinks(data.social_links);
          } else {
            // Convert old object format to array
            const links: { platform: string; url: string }[] = [];
            for (const [key, val] of Object.entries(data.social_links)) {
              if (val) links.push({ platform: key, url: val as string });
            }
            setSocialLinks(links);
          }
        }
        if (data.maintenance_mode !== undefined) setMaintenanceMode(!!data.maintenance_mode);
        if (data.announcement) { setAnnouncementText(data.announcement.text || ""); setAnnouncementVisible(data.announcement.visible !== false); }
        if (data.delivery_config) {
          const cfg = data.delivery_config;
          if (cfg.freeDeliveryEnabled !== undefined) delivery.setFreeDelivery(cfg.freeDeliveryEnabled);
          if (cfg.freeDeliveryThreshold) { delivery.setFreeDeliveryThreshold(cfg.freeDeliveryThreshold); setThresholdInput(String(cfg.freeDeliveryThreshold)); }
        }
        if (data.payment_methods && Array.isArray(data.payment_methods)) setPaymentMethods(data.payment_methods);
        if (data.notification_settings) setNotifications((p) => ({ ...p, ...data.notification_settings }));
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setThresholdInput(String(delivery.freeDeliveryThreshold)); });
  }, []);

  // ═══ SAVE HELPERS ═══
  const saveSettings = async (keys: Record<string, unknown>, setSaving: (v: boolean) => void, setSaved: (v: boolean) => void) => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(keys)) {
        await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
      }
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch {} finally { setSaving(false); }
  };

  const saveGeneral = () => saveSettings({ store_name: storeName, store_email: storeEmail, store_phone: storePhone, store_address: storeAddress, features }, setGeneralSaving, setGeneralSaved);
  const saveStoreSettings = () => saveSettings({ store_logo: storeLogo, store_tagline: storeTagline, about_text: aboutText, social_links: socialLinks, maintenance_mode: maintenanceMode, announcement: { text: announcementText, visible: announcementVisible } }, setStoreSaving, setStoreSaved);
  const saveDelivery = () => { const val = Number(thresholdInput); if (val > 0) delivery.setFreeDeliveryThreshold(val); saveSettings({ delivery_config: { freeDeliveryEnabled: delivery.freeDeliveryEnabled, freeDeliveryThreshold: val || delivery.freeDeliveryThreshold, zones: delivery.zones, partners: delivery.partners }, free_delivery_enabled: delivery.freeDeliveryEnabled, free_delivery_threshold: val || delivery.freeDeliveryThreshold }, setDeliverySaving, setDeliverySaved); };
  const savePayment = () => saveSettings({ payment_methods: paymentMethods }, setPaymentSaving, setPaymentSaved);
  const saveNotifications = () => saveSettings({ notification_settings: notifications }, setNotifSaving, setNotifSaved);

  const SaveBtn = ({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) => (
    <AdminButton onClick={onSave} disabled={saving} className={cn(saved && "!bg-success hover:!bg-success")}>
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
      {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
    </AdminButton>
  );

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-charcoal">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-pearl/60 p-1 rounded-xl overflow-x-auto">
        {tabList.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all", activeTab === tab.id ? "bg-white text-charcoal shadow-card" : "text-charcoal-lighter hover:text-charcoal")}>
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ GENERAL ═══ */}
      {activeTab === "general" && (
        <div className="space-y-5">
          <div className="flex justify-end"><SaveBtn saving={generalSaving} saved={generalSaved} onSave={saveGeneral} /></div>
          <div className="grid lg:grid-cols-2 gap-5">
            <Card><CardHeader><CardTitle className="text-base">Store Information</CardTitle><CardDescription>Basic contact details</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <Input label="Store Name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
                <Input label="Contact Email" value={storeEmail} onChange={(e) => setStoreEmail(e.target.value)} type="email" />
                <Input label="Contact Phone" value={storePhone} onChange={(e) => setStorePhone(e.target.value)} />
                <Textarea label="Store Address" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} />
                <Input label="Currency" value="BDT (৳)" disabled />
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-base">Features</CardTitle><CardDescription>Toggle store features</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {[{ key: "product_reviews", label: "Product Reviews", desc: "Allow reviews" }, { key: "wishlist", label: "Wishlist", desc: "Save products" }, { key: "compare_products", label: "Compare", desc: "Side-by-side" }, { key: "preorders", label: "Pre-orders", desc: "Accept pre-orders" }, { key: "guest_checkout", label: "Guest Checkout", desc: "Without account" }].map((f) => (
                  <div key={f.key} className="flex items-center justify-between"><div><p className="text-sm font-medium text-charcoal">{f.label}</p><p className="text-[10px] text-charcoal-lighter">{f.desc}</p></div><Switch checked={features[f.key] ?? true} onCheckedChange={() => setFeatures((p) => ({ ...p, [f.key]: !p[f.key] }))} /></div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ STORE ═══ */}
      {activeTab === "store" && (
        <div className="space-y-5">
          <div className="flex justify-end"><SaveBtn saving={storeSaving} saved={storeSaved} onSave={saveStoreSettings} /></div>
          <div className="grid lg:grid-cols-2 gap-5">
            <Card><CardHeader><CardTitle className="text-base">Branding</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <ImageUpload label="Store Logo" value={storeLogo} onChange={setStoreLogo} aspectRatio="square" folder="general" />
                <Input label="Tagline" value={storeTagline} onChange={(e) => setStoreTagline(e.target.value)} placeholder="True Beauty Knows No Borders" />
                <Textarea label="About" value={aboutText} onChange={(e) => setAboutText(e.target.value)} className="min-h-[80px]" />
              </CardContent>
            </Card>
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Social Links</CardTitle>
                    <AdminButton size="xs" onClick={() => setAddSocialOpen(true)}><Plus className="h-3 w-3" /> Add</AdminButton>
                  </div>
                </CardHeader>
                <CardContent>
                  {socialLinks.length === 0 && <p className="text-xs text-charcoal-lighter text-center py-3">No social links added</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {socialLinks.map((link, i) => {
                    const platform = getPlatform(link.platform);
                    return (
                      <div key={i} className="relative p-3 rounded-xl border border-border/30 bg-pearl/20 space-y-2">
                        <button onClick={() => setSocialLinks((prev) => prev.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 p-0.5 text-charcoal-lighter/40 hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full shrink-0" style={{ backgroundColor: platform?.color || "#666" }}>
                            {platform ? platform.whiteIcon : <span className="text-white text-xs">{link.platform[0]?.toUpperCase()}</span>}
                          </div>
                          <span className="text-xs font-medium text-charcoal">{platform?.name || link.platform}</span>
                        </div>
                        <Input
                          value={link.url}
                          onChange={(e) => setSocialLinks((prev) => prev.map((l, idx) => idx === i ? { ...l, url: e.target.value } : l))}
                          placeholder={platform?.placeholder || "URL"}
                          className="text-xs h-9"
                        />
                      </div>
                    );
                  })}
                  </div>
                </CardContent>
              </Card>

              {/* Add Social Link Dialog */}
              <Dialog open={addSocialOpen} onOpenChange={setAddSocialOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Add Social Link</DialogTitle></DialogHeader>
                  <div className="py-2">
                    <label className="block text-sm font-medium text-charcoal-light mb-1.5">Select Platform</label>
                    <div className="grid grid-cols-3 gap-2">
                      {SOCIAL_PLATFORMS.filter((p) => !socialLinks.some((l) => l.platform === p.id)).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setNewSocialPlatform(p.id)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all",
                            newSocialPlatform === p.id ? "border-secondary bg-secondary/5 shadow-sm" : "border-border/30 hover:border-secondary/40"
                          )}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: p.color }}>
                            {p.whiteIcon}
                          </div>
                          <span className="text-[10px] font-medium text-charcoal">{p.name}</span>
                        </button>
                      ))}
                    </div>
                    {SOCIAL_PLATFORMS.filter((p) => !socialLinks.some((l) => l.platform === p.id)).length === 0 && (
                      <p className="text-xs text-charcoal-lighter text-center py-4">All platforms added</p>
                    )}
                  </div>
                  <DialogFooter>
                    <AdminButton variant="outline" size="sm" onClick={() => { setAddSocialOpen(false); setNewSocialPlatform(""); }}>Cancel</AdminButton>
                    <AdminButton size="sm" disabled={!newSocialPlatform} onClick={() => {
                      setSocialLinks((prev) => [...prev, { platform: newSocialPlatform, url: "" }]);
                      setAddSocialOpen(false); setNewSocialPlatform("");
                    }}><Plus className="h-3 w-3" /> Add Platform</AdminButton>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Card><CardHeader><CardTitle className="text-base">Announcement</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3"><Switch checked={announcementVisible} onCheckedChange={setAnnouncementVisible} /><span className="text-sm text-charcoal-lighter">{announcementVisible ? "Visible" : "Hidden"}</span></div>
                  <Input value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} placeholder="Free delivery on orders over ৳3,000!" />
                </CardContent>
              </Card>
              <Card><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-charcoal">Maintenance Mode</p><p className="text-[10px] text-charcoal-lighter">Take store offline</p></div><Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} /></div></CardContent></Card>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELIVERY ═══ */}
      {activeTab === "delivery" && mounted && (
        <div className="space-y-5">
          <div className="flex justify-end"><SaveBtn saving={deliverySaving} saved={deliverySaved} onSave={saveDelivery} /></div>
          <div className="grid lg:grid-cols-2 gap-5">
            <Card><CardHeader><CardTitle className="text-base">Free Delivery</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3"><Switch checked={delivery.freeDeliveryEnabled} onCheckedChange={delivery.setFreeDelivery} /><span className="text-sm text-charcoal-lighter">{delivery.freeDeliveryEnabled ? "Enabled" : "Disabled"}</span></div>
                {delivery.freeDeliveryEnabled && <Input label="Min Order (৳)" type="number" value={thresholdInput} onChange={(e) => setThresholdInput(e.target.value)} />}
              </CardContent>
            </Card>
            <Card><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Delivery Zones</CardTitle><AdminButton size="xs" onClick={() => setZoneDialog(true)}><Plus className="h-3 w-3" /> Add</AdminButton></div></CardHeader>
              <CardContent className="space-y-2">
                {delivery.zones.map((z) => (
                  <div key={z.id} className="flex items-center justify-between p-3 rounded-lg bg-pearl/40">
                    <div><p className="text-sm font-medium text-charcoal">{z.name}</p><p className="text-[10px] text-charcoal-lighter">{z.estimatedDays} days · {formatCurrency(z.charge)}</p></div>
                    <div className="flex items-center gap-2">
                      <Switch checked={z.isActive} onCheckedChange={(v) => delivery.updateZone(z.id, { isActive: v })} />
                      <button onClick={() => delivery.removeZone(z.id)} className="p-1 text-charcoal-lighter hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
                {delivery.zones.length === 0 && <p className="text-xs text-charcoal-lighter text-center py-4">No zones</p>}
              </CardContent>
            </Card>
          </div>
          <Dialog open={zoneDialog} onOpenChange={setZoneDialog}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Add Delivery Zone</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <Input label="Zone Name" value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder="Dhaka City" />
                <Input label="Areas" value={zoneAreas} onChange={(e) => setZoneAreas(e.target.value)} placeholder="Gulshan, Banani" />
                <div className="grid grid-cols-2 gap-3"><Input label="Charge (৳)" type="number" value={zoneCharge} onChange={(e) => setZoneCharge(e.target.value)} /><Input label="Days" value={zoneDays} onChange={(e) => setZoneDays(e.target.value)} placeholder="1-2" /></div>
              </div>
              <DialogFooter>
                <AdminButton variant="outline" size="sm" onClick={() => setZoneDialog(false)}>Cancel</AdminButton>
                <AdminButton size="sm" disabled={!zoneName.trim()} onClick={() => { delivery.addZone({ id: `zone-${randomId()}`, name: zoneName.trim(), areas: zoneAreas.trim(), charge: Number(zoneCharge) || 0, estimatedDays: zoneDays.trim() || "3-5", isActive: true }); setZoneDialog(false); setZoneName(""); setZoneAreas(""); setZoneCharge(""); setZoneDays(""); }}><Plus className="h-3 w-3" /> Add</AdminButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ═══ PAYMENT ═══ */}
      {activeTab === "payment" && (
        <div className="space-y-5">
          <div className="flex justify-end"><SaveBtn saving={paymentSaving} saved={paymentSaved} onSave={savePayment} /></div>
          <div className="grid lg:grid-cols-2 gap-5">
            {paymentMethods.map((m) => (
              <Card key={m.id} className={cn(!m.enabled && "opacity-60")}>
                <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4 text-secondary" /> {m.name}</CardTitle><Switch checked={m.enabled} onCheckedChange={(v) => setPaymentMethods((p) => p.map((pm) => pm.id === m.id ? { ...pm, enabled: v } : pm))} /></div></CardHeader>
                {m.enabled && m.id !== "COD" && (
                  <CardContent className="space-y-3">
                    <Input label="Account / Phone" value={m.account_number} onChange={(e) => setPaymentMethods((p) => p.map((pm) => pm.id === m.id ? { ...pm, account_number: e.target.value } : pm))} placeholder="01XXXXXXXXX" />
                    <Input label="Instructions" value={m.instructions} onChange={(e) => setPaymentMethods((p) => p.map((pm) => pm.id === m.id ? { ...pm, instructions: e.target.value } : pm))} />
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ═══ NOTIFICATIONS ═══ */}
      {activeTab === "notifications" && (
        <div className="space-y-5">
          <div className="flex justify-end"><SaveBtn saving={notifSaving} saved={notifSaved} onSave={saveNotifications} /></div>
          <div className="grid lg:grid-cols-2 gap-5">
            {[
              { title: "Order Notifications", items: [{ key: "order_placed", label: "Order Placed", desc: "New order" }, { key: "order_confirmed", label: "Confirmed", desc: "Admin confirms" }, { key: "order_shipped", label: "Shipped", desc: "Shipping update" }, { key: "order_delivered", label: "Delivered", desc: "Delivery done" }, { key: "order_cancelled", label: "Cancelled", desc: "Cancellation" }] },
              { title: "Returns & Alerts", items: [{ key: "return_requested", label: "Return Requested", desc: "Customer request" }, { key: "return_approved", label: "Return Processed", desc: "Approved/rejected" }, { key: "low_stock_alert", label: "Low Stock", desc: "Below minimum" }, { key: "new_review", label: "New Review", desc: "Review posted" }, { key: "new_customer", label: "New Customer", desc: "Registration" }, { key: "points_earned", label: "Points Earned", desc: "Loyalty points" }, { key: "promo_offers", label: "Promotions", desc: "Marketing" }] },
            ].map((s) => (
              <Card key={s.title}><CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4 text-secondary" /> {s.title}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {s.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between"><div><p className="text-sm font-medium text-charcoal">{item.label}</p><p className="text-[10px] text-charcoal-lighter">{item.desc}</p></div><Switch checked={notifications[item.key] ?? true} onCheckedChange={() => setNotifications((p) => ({ ...p, [item.key]: !p[item.key] }))} /></div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
