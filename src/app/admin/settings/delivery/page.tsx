"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Truck, Package, MapPin, Globe, Check, Plus, Trash2,
  Edit, MoreHorizontal, ExternalLink, Clock, DollarSign, Shield,
  Sparkles, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { FieldLabel } from "@/components/admin/shared/field-label";
import { useDeliveryStore } from "@/stores/delivery.store";
import { formatCurrency, cn, randomId } from "@/lib/utils";

export default function DeliverySettingsPage() {
  const {
    freeDeliveryEnabled, freeDeliveryThreshold, zones, partners,
    setFreeDelivery, setFreeDeliveryThreshold, updateZone, addZone, removeZone,
    updatePartner, addPartner, removePartner
  } = useDeliveryStore();

  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [zoneDialog, setZoneDialog] = useState(false);
  const [partnerDialog, setPartnerDialog] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(String(freeDeliveryThreshold));
  const [editingZone, setEditingZone] = useState<string | null>(null);
  const [editZoneData, setEditZoneData] = useState({ name: "", areas: "", charge: "", estimatedDays: "" });

  // Zone form
  const [zoneName, setZoneName] = useState("");
  const [zoneAreas, setZoneAreas] = useState("");
  const [zoneCharge, setZoneCharge] = useState("");
  const [zoneDays, setZoneDays] = useState("");

  // Partner form
  const [partnerName, setPartnerName] = useState("");
  const [partnerUrl, setPartnerUrl] = useState("");

  const [dbSaving, setDbSaving] = useState(false);

  // Load delivery settings from DB on mount
  useEffect(() => {
    setMounted(true);
    setThresholdInput(String(freeDeliveryThreshold));
    fetch("/api/settings?keys=delivery_config")
      .then((r) => r.json())
      .then((data) => {
        if (data?.delivery_config) {
          const cfg = data.delivery_config;
          if (cfg.freeDeliveryEnabled !== undefined) setFreeDelivery(cfg.freeDeliveryEnabled);
          if (cfg.freeDeliveryThreshold) { setFreeDeliveryThreshold(cfg.freeDeliveryThreshold); setThresholdInput(String(cfg.freeDeliveryThreshold)); }
          if (cfg.zones?.length) {
            // Replace zones from DB
            for (const z of cfg.zones) addZone(z);
          }
          if (cfg.partners?.length) {
            for (const p of cfg.partners) addPartner(p);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Save all delivery settings to DB
  const saveToDb = async () => {
    setDbSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "delivery_config",
          value: { freeDeliveryEnabled, freeDeliveryThreshold, zones, partners },
        }),
      });
      showSaved();
    } catch {} finally { setDbSaving(false); }
  };

  const handleSaveThreshold = () => {
    const val = Number(thresholdInput);
    if (val > 0) { setFreeDeliveryThreshold(val); }
  };

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const handleAddZone = () => {
    if (!zoneName.trim()) return;
    addZone({
      id: `zone-${randomId()}`,
      name: zoneName.trim(),
      areas: zoneAreas.trim(),
      charge: Number(zoneCharge) || 0,
      estimatedDays: zoneDays.trim() || "3-5",
      isActive: true,
    });
    setZoneDialog(false);
    setZoneName(""); setZoneAreas(""); setZoneCharge(""); setZoneDays("");
    showSaved();
  };

  const handleAddPartner = () => {
    if (!partnerName.trim()) return;
    addPartner({
      id: `partner-${randomId()}`,
      name: partnerName.trim(),
      trackingUrl: partnerUrl.trim(),
      zones: zones.map((z) => z.id),
      isActive: true,
    });
    setPartnerDialog(false);
    setPartnerName(""); setPartnerUrl("");
    showSaved();
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/settings" className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold text-charcoal">Delivery Management</h1>
            <p className="text-xs text-charcoal-lighter">Configure shipping zones, charges, and delivery partners</p>
          </div>
        </div>
        <AdminButton onClick={saveToDb} disabled={dbSaving} className={cn("shrink-0", saved && "!bg-success hover:!bg-success")}>
          {dbSaving ? <Clock className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
          {saved ? "Saved!" : dbSaving ? "Saving..." : "Save All Settings"}
        </AdminButton>
      </div>

      {/* Saved toast */}
      <AnimatePresence>
        {saved && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">
            <Check className="h-4 w-4" /> Settings saved! Changes are live on the storefront.
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ FREE DELIVERY ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-secondary" /> Free Delivery</CardTitle>
          <CardDescription>Configure free delivery threshold for your customers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-pearl/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 shrink-0">
                <Truck className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-semibold text-charcoal"><FieldLabel label="Enable Free Delivery" hint="Offer free shipping when order total exceeds threshold" /></p>
              </div>
            </div>
            <Switch checked={freeDeliveryEnabled} onCheckedChange={(v) => { setFreeDelivery(v); showSaved(); }} />
          </div>

          {freeDeliveryEnabled && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-1.5">Minimum Order Amount for Free Delivery</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-xl border border-border overflow-hidden focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20 transition-all flex-1 max-w-xs">
                    <span className="px-3 text-sm text-charcoal-lighter bg-pearl border-r border-border h-11 flex items-center">৳</span>
                    <input type="number" value={thresholdInput} onChange={(e) => setThresholdInput(e.target.value)}
                      className="flex-1 h-11 px-3 text-sm font-medium text-charcoal bg-transparent outline-none" />
                  </div>
                  <AdminButton size="sm" onClick={handleSaveThreshold}>Save</AdminButton>
                </div>
                <p className="text-[10px] text-charcoal-lighter mt-1.5">
                  Currently: Orders above <span className="font-semibold text-charcoal">{formatCurrency(freeDeliveryThreshold)}</span> get free delivery
                </p>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* ═══ DELIVERY ZONES ═══ */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-secondary" /> Delivery Zones</CardTitle>
            <CardDescription className="text-xs mt-0.5">{zones.filter((z) => z.isActive).length} active zones</CardDescription>
          </div>
          <AdminButton size="sm" onClick={() => { setZoneName(""); setZoneAreas(""); setZoneCharge(""); setZoneDays(""); setZoneDialog(true); }}>
            <Plus className="h-3.5 w-3.5" /> Add Zone
          </AdminButton>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/20 text-left">
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Zone</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden sm:table-cell">Areas</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Charge</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden md:table-cell">Delivery Time</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  editingZone === zone.id ? (
                    <tr key={zone.id} className="border-b border-secondary/20 bg-primary-light/30">
                      <td className="px-4 py-2">
                        <input value={editZoneData.name} onChange={(e) => setEditZoneData({ ...editZoneData, name: e.target.value })}
                          className="w-full h-8 px-2 text-sm font-medium border border-secondary/30 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-secondary/20" />
                      </td>
                      <td className="px-4 py-2 hidden sm:table-cell">
                        <input value={editZoneData.areas} onChange={(e) => setEditZoneData({ ...editZoneData, areas: e.target.value })}
                          className="w-full h-8 px-2 text-xs border border-secondary/30 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-secondary/20" />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-charcoal-lighter">৳</span>
                          <input type="number" value={editZoneData.charge} onChange={(e) => setEditZoneData({ ...editZoneData, charge: e.target.value })}
                            className="w-16 h-8 px-2 text-sm font-medium text-center border border-secondary/30 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-secondary/20" />
                        </div>
                      </td>
                      <td className="px-4 py-2 hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <input value={editZoneData.estimatedDays} onChange={(e) => setEditZoneData({ ...editZoneData, estimatedDays: e.target.value })}
                            className="w-14 h-8 px-2 text-xs text-center border border-secondary/30 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-secondary/20" />
                          <span className="text-[10px] text-charcoal-lighter">days</span>
                        </div>
                      </td>
                      <td className="px-4 py-2" colSpan={2}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => {
                            updateZone(zone.id, { name: editZoneData.name, areas: editZoneData.areas, charge: Number(editZoneData.charge), estimatedDays: editZoneData.estimatedDays });
                            setEditingZone(null); showSaved();
                          }} className="h-7 w-7 flex items-center justify-center rounded-full bg-success !text-white hover:bg-success/90 transition-colors">
                            <Check className="h-3 w-3" />
                          </button>
                          <button onClick={() => setEditingZone(null)} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-destructive/10 text-charcoal-lighter hover:text-destructive transition-colors">
                            <span className="text-xs font-bold">✕</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={zone.id} className={cn("border-b border-border/10 hover:bg-pearl/50 transition-colors", !zone.isActive && "opacity-50")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-secondary shrink-0" />
                          <span className="font-medium text-charcoal">{zone.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-xs text-charcoal-lighter truncate max-w-[200px]">{zone.areas}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-charcoal">{formatCurrency(zone.charge)}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="flex items-center gap-1 text-xs text-charcoal-lighter"><Clock className="h-3 w-3" /> {zone.estimatedDays} days</span>
                      </td>
                      <td className="px-4 py-3">
                        <Switch checked={zone.isActive} onCheckedChange={(v) => { updateZone(zone.id, { isActive: v }); showSaved(); }} />
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1.5 hover:bg-pearl rounded-lg"><MoreHorizontal className="h-4 w-4 text-charcoal-lighter" /></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingZone(zone.id); setEditZoneData({ name: zone.name, areas: zone.areas, charge: String(zone.charge), estimatedDays: zone.estimatedDays }); }}>
                              <Edit className="h-3.5 w-3.5 mr-2" /> Edit Zone
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => { removeZone(zone.id); showSaved(); }}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ═══ DELIVERY PARTNERS ═══ */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4 text-secondary" /> Delivery Partners</CardTitle>
            <CardDescription className="text-xs mt-0.5">Courier services used for delivery</CardDescription>
          </div>
          <AdminButton size="sm" onClick={() => { setPartnerName(""); setPartnerUrl(""); setPartnerDialog(true); }}>
            <Plus className="h-3.5 w-3.5" /> Add Partner
          </AdminButton>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {partners.map((partner) => (
              <div key={partner.id} className={cn("flex items-center justify-between p-4 rounded-xl border border-border/30", !partner.isActive && "opacity-50 bg-pearl/30")}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 shrink-0">
                    <Truck className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">{partner.name}</p>
                    <p className="text-[10px] text-charcoal-lighter">{partner.zones.length} zones covered</p>
                    {partner.trackingUrl && (
                      <a href={partner.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] text-secondary flex items-center gap-0.5 hover:underline">
                        <ExternalLink className="h-2.5 w-2.5" /> Track
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={partner.isActive} onCheckedChange={(v) => { updatePartner(partner.id, { isActive: v }); showSaved(); }} />
                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-1 hover:bg-pearl rounded-lg"><MoreHorizontal className="h-4 w-4 text-charcoal-lighter" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Edit className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => { removePartner(partner.id); showSaved(); }}><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══ QUICK REFERENCE ═══ */}
      <Card className="bg-primary-light/30 border-0">
        <CardContent className="p-5">
          <p className="text-xs font-semibold text-charcoal mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-secondary" /> Where these settings apply:</p>
          <ul className="text-[11px] text-charcoal-light space-y-1 leading-relaxed">
            <li>• <span className="font-medium text-charcoal">Free delivery threshold</span> — controls when free shipping kicks in at checkout and cart</li>
            <li>• <span className="font-medium text-charcoal">Zone charges</span> — determine shipping cost based on customer address</li>
            <li>• <span className="font-medium text-charcoal">Delivery time</span> — shown on product pages and checkout</li>
            <li>• <span className="font-medium text-charcoal">Partners</span> — available courier services for order fulfillment</li>
            <li>• <span className="font-medium text-charcoal">Topbar announcement</span> — a &ldquo;Free Shipping&rdquo; announcement in Announcements automatically uses this threshold</li>
          </ul>
        </CardContent>
      </Card>

      {/* ═══ Add Zone Dialog ═══ */}
      <Dialog open={zoneDialog} onOpenChange={setZoneDialog}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader><DialogTitle>Add Delivery Zone</DialogTitle><DialogDescription>Create a new shipping zone</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <Input label="Zone Name" placeholder="e.g., Dhaka City" value={zoneName} onChange={(e) => setZoneName(e.target.value)} />
            <Input label="Areas Covered" placeholder="e.g., Gulshan, Banani, Dhanmondi..." value={zoneAreas} onChange={(e) => setZoneAreas(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Charge (৳)" placeholder="60" type="number" value={zoneCharge} onChange={(e) => setZoneCharge(e.target.value)} />
              <Input label="Estimated Days" placeholder="1-2" value={zoneDays} onChange={(e) => setZoneDays(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setZoneDialog(false)}>Cancel</AdminButton>
            <AdminButton onClick={handleAddZone} disabled={!zoneName.trim()}><Plus className="h-3.5 w-3.5" /> Add Zone</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Add Partner Dialog ═══ */}
      <Dialog open={partnerDialog} onOpenChange={setPartnerDialog}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader><DialogTitle>Add Delivery Partner</DialogTitle><DialogDescription>Add a new courier service</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <Input label="Company Name" placeholder="e.g., Steadfast Courier" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} />
            <Input label="Tracking URL (Optional)" placeholder="https://company.com/track" value={partnerUrl} onChange={(e) => setPartnerUrl(e.target.value)} />
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setPartnerDialog(false)}>Cancel</AdminButton>
            <AdminButton onClick={handleAddPartner} disabled={!partnerName.trim()}><Plus className="h-3.5 w-3.5" /> Add Partner</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
