"use client";

import { useState, useEffect } from "react";
import {
  Crown, Edit, Trash2, Plus, Save, Loader2, Star,
  Settings, Award, TrendingUp, X
} from "lucide-react";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";
import type { MembershipTier } from "@/types/membership";

/** Convert hex to light bg + dark text color pair for tier name badges */
function hexToTierStyle(hex: string): { bg: string; text: string } {
  return { bg: `${hex}18`, text: hex };
}

export default function AdminMembershipPage() {
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pointsPerTaka, setPointsPerTaka] = useState(10);
  const [pointsEnabled, setPointsEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTier, setEditTier] = useState<MembershipTier | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<MembershipTier | null>(null);

  // Form
  const [formName, setFormName] = useState("");
  const [formMinPoints, setFormMinPoints] = useState(0);
  const [formMaxPoints, setFormMaxPoints] = useState(0);
  const [formMultiplier, setFormMultiplier] = useState(1);
  const [formColor, setFormColor] = useState("#6B7280");
  const [showNameColorPicker, setShowNameColorPicker] = useState(false);
  const [showBadgeColorPicker, setShowBadgeColorPicker] = useState(false);
  const [formBenefits, setFormBenefits] = useState<string[]>([""]);
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formBadgeEnabled, setFormBadgeEnabled] = useState(false);
  const [formBadgeColor, setFormBadgeColor] = useState("#3B82F6");
  const [formBadgeOpacity, setFormBadgeOpacity] = useState(1);
  const [formActive, setFormActive] = useState(true);

  const fetchTiers = async () => {
    try {
      const res = await fetch("/api/membership/tiers");
      const data = await res.json();
      if (Array.isArray(data)) setTiers(data);
    } catch {} finally { setLoading(false); }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/membership/settings");
      const data = await res.json();
      if (data.points_per_taka !== undefined) setPointsPerTaka(Number(data.points_per_taka));
      if (data.points_enabled !== undefined) setPointsEnabled(!!data.points_enabled);
    } catch {}
  };

  useEffect(() => { fetchTiers(); fetchSettings(); }, []);

  const resetForm = () => {
    setFormName(""); setFormMinPoints(0); setFormMaxPoints(0);
    setFormMultiplier(1); setFormColor("#6B7280"); setShowNameColorPicker(false); setShowBadgeColorPicker(false);
    setFormBadgeEnabled(false); setFormBadgeColor("#3B82F6"); setFormBadgeOpacity(1);
    setFormBenefits([""]); setFormSortOrder(0); setFormActive(true);
    setEditTier(null);
  };

  const openCreate = () => {
    resetForm();
    setFormSortOrder(tiers.length + 1);
    setDialogOpen(true);
  };

  const openEdit = (tier: MembershipTier) => {
    setEditTier(tier);
    setFormName(tier.name);
    setFormMinPoints(tier.min_points);
    setFormMaxPoints(tier.max_points);
    setFormMultiplier(tier.points_multiplier);
    setFormColor(tier.color);
    setFormBadgeEnabled(!!tier.badge_enabled);
    setFormBadgeColor(tier.badge_color || "#3B82F6");
    setFormBadgeOpacity(tier.badge_opacity ?? 1);
    setFormBenefits(tier.benefits.length > 0 ? tier.benefits : [""]);
    setFormSortOrder(tier.sort_order);
    setFormActive(tier.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        min_points: formMinPoints,
        max_points: formMaxPoints,
        points_multiplier: formMultiplier,
        color: formColor,
        // Keep the configured badge_name/color/opacity even while disabled,
        // so toggling it back on restores the previous look instead of
        // requiring the admin to reconfigure it from scratch.
        badge_name: formName.trim(),
        badge_color: formBadgeColor,
        badge_opacity: formBadgeOpacity,
        badge_enabled: formBadgeEnabled,
        benefits: formBenefits.filter((b) => b.trim()),
        sort_order: formSortOrder,
        is_active: formActive,
      };

      if (editTier) {
        await fetch(`/api/membership/tiers/${editTier.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/membership/tiers", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setDialogOpen(false);
      resetForm();
      fetchTiers();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await fetch(`/api/membership/tiers/${deleteDialog.id}`, { method: "DELETE" });
      setDeleteDialog(null);
      fetchTiers();
    } catch {}
  };

  const handleToggleActive = async (tier: MembershipTier) => {
    await fetch(`/api/membership/tiers/${tier.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !tier.is_active }),
    });
    fetchTiers();
  };

  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    try {
      await fetch("/api/membership/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points_per_taka: pointsPerTaka, points_enabled: pointsEnabled }),
      });
    } catch {} finally { setSettingsLoading(false); }
  };

  const addBenefit = () => setFormBenefits([...formBenefits, ""]);
  const removeBenefit = (i: number) => setFormBenefits(formBenefits.filter((_, idx) => idx !== i));
  const updateBenefit = (i: number, v: string) => {
    const next = [...formBenefits];
    next[i] = v;
    setFormBenefits(next);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal flex items-center gap-2">
            <Crown className="h-6 w-6 text-gold" /> Membership & Loyalty
          </h1>
          <p className="text-sm text-charcoal-lighter">Manage tiers, points calculation, and member benefits</p>
        </div>
        <AdminButton size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> Add Tier
        </AdminButton>
      </div>

      {/* Points Settings Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-charcoal-lighter" /> Points Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-charcoal-lighter whitespace-nowrap">Loyalty Points</label>
              <Switch checked={pointsEnabled} onCheckedChange={setPointsEnabled} />
              <span className="text-xs text-charcoal-lighter">{pointsEnabled ? "Enabled" : "Disabled"}</span>
            </div>
            <Separator orientation="vertical" className="h-8 hidden sm:block" />
            <div className="flex items-end gap-2">
              <div>
                <label className="text-xs text-charcoal-lighter block mb-1">Earn 1 point per</label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    value={pointsPerTaka}
                    onChange={(e) => setPointsPerTaka(Number(e.target.value))}
                    className="w-24"
                    min={1}
                  />
                  <span className="text-sm text-charcoal-lighter">BDT spent</span>
                </div>
              </div>
            </div>
            <AdminButton variant="outline" size="sm" onClick={handleSaveSettings} disabled={settingsLoading}>
              {settingsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Settings
            </AdminButton>
          </div>
          <p className="text-[10px] text-charcoal-lighter mt-3">
            Example: With current settings, a {formatCurrency(1000)} purchase earns {Math.floor(1000 / pointsPerTaka)} points (base rate). Tier multipliers apply on top.
          </p>
        </CardContent>
      </Card>

      {/* Tiers Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-charcoal-lighter" />
        </div>
      ) : tiers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Award className="h-12 w-12 text-charcoal-lighter mx-auto mb-3" />
            <h3 className="font-medium text-charcoal mb-1">No tiers configured</h3>
            <p className="text-sm text-charcoal-lighter mb-4">Create membership tiers to reward your customers</p>
            <AdminButton size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Add First Tier</AdminButton>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((tier) => (
            <Card key={tier.id} className={cn("relative overflow-hidden transition-opacity", !tier.is_active && "opacity-60")}>
              <CardContent className="p-5">
                {/* Tier Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span
                      className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2"
                      style={{
                        backgroundColor: tier.color.startsWith("#") ? `${tier.color}18` : undefined,
                        color: tier.color.startsWith("#") ? tier.color : undefined,
                      }}
                    >
                      {!tier.color.startsWith("#") && <Badge className={cn("text-xs font-semibold", tier.color)}>{tier.name}</Badge>}
                      {tier.color.startsWith("#") && tier.name}
                    </span>
                    <p className="text-[10px] text-charcoal-lighter">
                      {tier.min_points.toLocaleString()} — {tier.max_points.toLocaleString()} points
                    </p>
                  </div>
                  <Switch checked={tier.is_active} onCheckedChange={() => handleToggleActive(tier)} />
                </div>

                {/* Multiplier */}
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-secondary" />
                  <span className="text-sm font-semibold text-charcoal">{tier.points_multiplier}x</span>
                  <span className="text-[10px] text-charcoal-lighter">points multiplier</span>
                </div>

                {/* Badge Preview */}
                {tier.badge_enabled && tier.badge_color && (
                  <div className="flex items-center gap-1.5 mb-3 p-2 rounded-lg bg-pearl/50">
                    <VerifiedBadge color={tier.badge_color} opacity={tier.badge_opacity ?? 1} size={22} tooltip={tier.name} />
                    <span className="text-[11px] font-medium text-charcoal">Verified Badge</span>
                  </div>
                )}

                {/* Benefits */}
                {tier.benefits && tier.benefits.length > 0 && (
                  <div className="space-y-1 mb-4">
                    {tier.benefits.map((b, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <Star className="h-3 w-3 text-gold mt-0.5 shrink-0" />
                        <span className="text-[11px] text-charcoal-lighter">{b}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-border/20">
                  <AdminButton variant="outline" size="sm" className="flex-1" onClick={() => openEdit(tier)}>
                    <Edit className="h-3 w-3" /> Edit
                  </AdminButton>
                  <AdminButton variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialog(tier)}>
                    <Trash2 className="h-3 w-3" />
                  </AdminButton>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Tier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editTier ? "Edit Tier" : "Add Tier"}</DialogTitle>
            <DialogDescription>{editTier ? "Update tier settings" : "Create a new membership tier"}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            <Input label="Tier Name *" placeholder="e.g. Diamond" value={formName} onChange={(e) => setFormName(e.target.value)} />

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Input label="Min Points *" type="number" value={formMinPoints} onChange={(e) => setFormMinPoints(Number(e.target.value))} min={0} />
              <Input label="Max Points *" type="number" value={formMaxPoints} onChange={(e) => setFormMaxPoints(Number(e.target.value))} min={0} />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Input label="Points Multiplier" type="number" value={formMultiplier} onChange={(e) => setFormMultiplier(Number(e.target.value))} min={0.5} step={0.25} />
              <Input label="Sort Order" type="number" value={formSortOrder} onChange={(e) => setFormSortOrder(Number(e.target.value))} min={0} />
            </div>

            {/* Tier Name Badge Color */}
            <div>
              <label className="block text-sm font-medium text-charcoal-lighter mb-1.5">Tier Name Badge Color</label>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setShowNameColorPicker(!showNameColorPicker)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-secondary transition-colors shrink-0"
                >
                  <span className="h-5 w-5 rounded-full border border-border/30 shrink-0" style={{ backgroundColor: formColor.startsWith("#") ? formColor : "#6B7280" }} />
                  <span className="text-xs font-mono text-charcoal">{formColor.startsWith("#") ? formColor : "#6B7280"}</span>
                </button>
                {/* Preview */}
                <span
                  className="px-3 py-1 rounded-full text-[10px] font-semibold truncate max-w-[140px]"
                  style={{
                    backgroundColor: (formColor.startsWith("#") ? formColor : "#6B7280") + "18",
                    color: formColor.startsWith("#") ? formColor : "#6B7280",
                  }}
                >
                  {formName || "Tier Name"}
                </span>
              </div>
              {showNameColorPicker && (
                <div className="mt-2 p-3 rounded-xl border border-border/30 bg-white shadow-lg relative">
                  <button type="button" onClick={() => setShowNameColorPicker(false)} className="absolute top-2 right-2 p-1 hover:bg-pearl rounded-full text-charcoal-lighter hover:text-charcoal transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-center gap-3">
                    <input type="color" value={formColor.startsWith("#") ? formColor : "#6B7280"} onChange={(e) => setFormColor(e.target.value)} className="h-10 w-14 rounded-lg border border-border cursor-pointer" />
                    <Input value={formColor.startsWith("#") ? formColor : "#6B7280"} onChange={(e) => setFormColor(e.target.value)} className="flex-1 font-mono text-xs" placeholder="#6B7280" />
                  </div>
                </div>
              )}
            </div>

            {/* Verified Badge */}
            <div className="space-y-3 p-3 rounded-xl bg-pearl/40 border border-border/20">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Switch checked={formBadgeEnabled} onCheckedChange={setFormBadgeEnabled} />
                <span className="text-sm font-medium text-charcoal">Enable Verified Badge</span>
              </label>
              {formBadgeEnabled && (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowBadgeColorPicker(!showBadgeColorPicker)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-secondary transition-colors shrink-0"
                    >
                      <span className="h-5 w-5 rounded-full border border-border/30 shrink-0" style={{ backgroundColor: formBadgeColor }} />
                      <span className="text-xs font-mono text-charcoal">{formBadgeColor}</span>
                    </button>
                    <div className="shrink-0">
                      <label className="block text-[10px] text-charcoal-lighter">Opacity {Math.round(formBadgeOpacity * 100)}%</label>
                      <input type="range" min="0.3" max="1" step="0.05" value={formBadgeOpacity} onChange={(e) => setFormBadgeOpacity(Number(e.target.value))} className="w-24 accent-secondary" />
                    </div>
                  </div>
                  {showBadgeColorPicker && (
                    <div className="p-3 rounded-xl border border-border/30 bg-white shadow-lg relative">
                      <button type="button" onClick={() => setShowBadgeColorPicker(false)} className="absolute top-2 right-2 p-1 hover:bg-pearl rounded-full text-charcoal-lighter hover:text-charcoal transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <div className="flex items-center gap-3">
                        <input type="color" value={formBadgeColor} onChange={(e) => setFormBadgeColor(e.target.value)} className="h-10 w-14 rounded-lg border border-border cursor-pointer" />
                        <Input value={formBadgeColor} onChange={(e) => setFormBadgeColor(e.target.value)} className="flex-1 font-mono text-xs" placeholder="#3B82F6" />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white">
                    <span className="text-xs text-charcoal-lighter">Preview:</span>
                    <span className="text-sm font-medium text-charcoal">Customer Name</span>
                    <VerifiedBadge color={formBadgeColor} opacity={formBadgeOpacity} size={22} tooltip={formName || "Tier"} />
                  </div>
                </>
              )}
            </div>

            {/* Benefits */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-charcoal-lighter">Benefits</label>
                <button type="button" onClick={addBenefit} className="text-[10px] text-secondary hover:text-secondary-dark font-medium">+ Add</button>
              </div>
              <div className="space-y-2">
                {formBenefits.map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="e.g. Free shipping on all orders"
                      value={b}
                      onChange={(e) => updateBenefit(i, e.target.value)}
                      className="flex-1"
                    />
                    {formBenefits.length > 1 && (
                      <button type="button" onClick={() => removeBenefit(i)} className="p-2 text-charcoal-lighter hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={formActive} onCheckedChange={setFormActive} />
              <label className="text-sm text-charcoal-lighter">Active</label>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-3">
            <AdminButton variant="outline" size="sm" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</AdminButton>
            <AdminButton size="sm" onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {editTier ? "Update" : "Create"} Tier
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Tier</DialogTitle>
            <DialogDescription>Are you sure you want to delete &quot;{deleteDialog?.name}&quot;? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <AdminButton variant="outline" size="sm" onClick={() => setDeleteDialog(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" size="sm" onClick={handleDelete}>Delete</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
