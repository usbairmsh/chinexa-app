"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit, Save, Loader2, Check, X, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { EmptyState } from "@/components/ui/empty-state";
import { TRUST_ICON_PACK, getIconById, type TrustBadge } from "@/lib/trust-badges";
import { cn } from "@/lib/utils";

const TITLE_MAX = 25;
const DESC_MAX = 40;

export default function TrustBadgesPage() {
  const [badges, setBadges] = useState<TrustBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [formIcon, setFormIcon] = useState("Shield");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");

  useEffect(() => {
    fetch("/api/settings?key=trust_badges_config")
      .then((r) => r.json())
      .then((data) => {
        if (data?.value && Array.isArray(data.value)) setBadges(data.value);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "trust_badges_config", value: badges }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch {} finally { setSaving(false); }
  };

  const resetForm = () => {
    setFormIcon("Shield"); setFormTitle(""); setFormDesc(""); setEditIndex(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (index: number) => {
    const b = badges[index];
    setEditIndex(index);
    setFormIcon(b.icon);
    setFormTitle(b.title);
    setFormDesc(b.description);
    setDialogOpen(true);
  };

  const handleAddOrUpdate = () => {
    if (!formTitle.trim()) return;
    const badge: TrustBadge = {
      id: editIndex !== null ? badges[editIndex].id : `tb-${Date.now()}`,
      icon: formIcon,
      title: formTitle.trim().slice(0, TITLE_MAX),
      description: formDesc.trim().slice(0, DESC_MAX),
    };
    if (editIndex !== null) {
      setBadges((prev) => prev.map((b, i) => i === editIndex ? badge : b));
    } else {
      setBadges((prev) => [...prev, badge]);
    }
    setDialogOpen(false); resetForm();
  };

  const handleDelete = (index: number) => {
    setBadges((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Trust Badges</h1>
          <p className="text-sm text-charcoal-lighter">Configure trust badges available for products</p>
        </div>
        <div className="flex gap-2">
          <AdminButton variant="outline" onClick={openCreate}><Plus className="h-4 w-4" /> Add Badge</AdminButton>
          <AdminButton onClick={handleSave} disabled={saving} className={saved ? "!bg-success hover:!bg-success" : ""}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Saved!" : "Save All"}
          </AdminButton>
        </div>
      </div>

      {badges.length === 0 ? (
        <EmptyState icon={Shield} title="No trust badges" description="Create trust badges that can be added to products." actionLabel="Add Badge" onAction={openCreate} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {badges.map((badge, i) => {
            const Icon = getIconById(badge.icon);
            return (
              <Card key={badge.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col items-center text-center">
                    <Icon className="h-8 w-8 text-secondary mb-3" />
                    <h3 className="text-sm font-semibold text-charcoal mb-0.5">{badge.title}</h3>
                    <p className="text-[10px] text-charcoal-lighter">{badge.description}</p>
                  </div>
                  <div className="flex justify-center gap-2 mt-4 pt-3 border-t border-border/20">
                    <button onClick={() => openEdit(i)} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-medium text-charcoal-lighter border border-border/30 hover:border-secondary hover:text-secondary transition-all">
                      <Edit className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => handleDelete(i)} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-medium text-charcoal-lighter border border-border/30 hover:border-destructive hover:text-destructive transition-all">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editIndex !== null ? "Edit Badge" : "Add Trust Badge"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Icon Picker */}
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-2">Select Icon</label>
              <div className="grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto p-1">
                {TRUST_ICON_PACK.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFormIcon(item.id)}
                    title={item.name}
                    className={cn(
                      "flex items-center justify-center h-10 w-10 rounded-lg border transition-all",
                      formIcon === item.id ? "border-secondary bg-secondary/10 text-secondary scale-110" : "border-border/30 text-charcoal-lighter hover:border-secondary/40 hover:text-secondary"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <Input label={`Title (max ${TITLE_MAX} chars)`} value={formTitle} onChange={(e) => setFormTitle(e.target.value.slice(0, TITLE_MAX))} placeholder="e.g., 100% Authentic" maxLength={TITLE_MAX} />
              <p className={cn("text-[10px] mt-0.5 text-right", formTitle.length >= TITLE_MAX ? "text-destructive" : "text-charcoal-lighter")}>{formTitle.length}/{TITLE_MAX}</p>
            </div>

            {/* Description */}
            <div>
              <Input label={`Description (max ${DESC_MAX} chars)`} value={formDesc} onChange={(e) => setFormDesc(e.target.value.slice(0, DESC_MAX))} placeholder="e.g., Verified products" maxLength={DESC_MAX} />
              <p className={cn("text-[10px] mt-0.5 text-right", formDesc.length >= DESC_MAX ? "text-destructive" : "text-charcoal-lighter")}>{formDesc.length}/{DESC_MAX}</p>
            </div>

            {/* Preview */}
            <div className="p-4 rounded-xl bg-pearl/60 flex flex-col items-center text-center">
              <p className="text-[9px] text-charcoal-lighter uppercase tracking-wider font-semibold mb-2">Preview</p>
              {(() => { const Icon = getIconById(formIcon); return <Icon className="h-6 w-6 text-secondary mb-1.5" />; })()}
              <span className="text-[11px] font-semibold text-charcoal">{formTitle || "Badge Title"}</span>
              <span className="text-[9px] text-charcoal-lighter">{formDesc || "Badge description"}</span>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-3">
            <AdminButton variant="outline" size="sm" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</AdminButton>
            <AdminButton size="sm" onClick={handleAddOrUpdate} disabled={!formTitle.trim()}>
              {editIndex !== null ? <><Check className="h-3 w-3" /> Update</> : <><Plus className="h-3 w-3" /> Add Badge</>}
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
