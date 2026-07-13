"use client";

import { useState, useEffect } from "react";
import { FileText, Plus, Trash2, Edit, Save, Loader2, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { randomId } from "@/lib/utils";
import type { PolicyPage, PolicySection } from "@/types/policy";
import { DEFAULT_POLICY_PAGES } from "@/types/policy";
import { useAdmin } from "@/contexts/admin-context";

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || randomId();
}

export default function AdminPoliciesPage() {
  const { can } = useAdmin();
  const canEdit = can("policies", "edit");
  const [policies, setPolicies] = useState<PolicyPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PolicyPage | null>(null);

  // Form
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formIntro, setFormIntro] = useState("");
  const [formSections, setFormSections] = useState<PolicySection[]>([{ heading: "", body: [""] }]);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    fetch("/api/settings?key=policy_pages")
      .then((r) => r.json())
      .then((data) => setPolicies(Array.isArray(data?.value) && data.value.length > 0 ? data.value : DEFAULT_POLICY_PAGES))
      .catch(() => setPolicies(DEFAULT_POLICY_PAGES))
      .finally(() => setLoading(false));
  }, []);

  const persist = async (next: PolicyPage[]) => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "policy_pages", value: next }),
      });
      setPolicies(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  };

  const resetForm = () => {
    setFormTitle(""); setFormSlug(""); setFormIntro("");
    setFormSections([{ heading: "", body: [""] }]);
    setSlugManuallyEdited(false);
    setEditingSlug(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (policy: PolicyPage) => {
    setEditingSlug(policy.slug);
    setFormTitle(policy.title);
    setFormSlug(policy.slug);
    setFormIntro(policy.intro);
    setFormSections(policy.sections.length > 0 ? policy.sections : [{ heading: "", body: [""] }]);
    setSlugManuallyEdited(true);
    setDialogOpen(true);
  };

  const updateSection = (i: number, patch: Partial<PolicySection>) => {
    setFormSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const updateSectionLine = (si: number, li: number, value: string) => {
    setFormSections((prev) => prev.map((s, idx) => (idx === si ? { ...s, body: s.body.map((b, bi) => (bi === li ? value : b)) } : s)));
  };
  const addSectionLine = (si: number) => {
    setFormSections((prev) => prev.map((s, idx) => (idx === si ? { ...s, body: [...s.body, ""] } : s)));
  };
  const removeSectionLine = (si: number, li: number) => {
    setFormSections((prev) => prev.map((s, idx) => (idx === si ? { ...s, body: s.body.filter((_, bi) => bi !== li) } : s)));
  };
  const addSection = () => setFormSections((prev) => [...prev, { heading: "", body: [""] }]);
  const removeSection = (i: number) => setFormSections((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!formTitle.trim()) return;
    const slug = editingSlug || slugify(formSlug || formTitle);
    const cleanedSections = formSections
      .map((s) => ({ heading: s.heading.trim(), body: s.body.map((b) => b.trim()).filter(Boolean) }))
      .filter((s) => s.heading && s.body.length > 0);

    const newPolicy: PolicyPage = { slug, title: formTitle.trim(), intro: formIntro.trim(), sections: cleanedSections };

    const next = editingSlug
      ? policies.map((p) => (p.slug === editingSlug ? newPolicy : p))
      : [...policies, newPolicy];

    await persist(next);
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await persist(policies.filter((p) => p.slug !== deleteTarget.slug));
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 text-secondary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal flex items-center gap-2">
            <FileText className="h-6 w-6 text-secondary" /> Policy Pages
          </h1>
          <p className="text-sm text-charcoal-lighter">Manage Shipping, Returns, Privacy, Terms, and any other policy page — each is reachable at /policies/[slug].</p>
        </div>
        {canEdit && (
          <AdminButton onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Add Policy Page</AdminButton>
        )}
      </div>

      {saved && <p className="text-xs text-success flex items-center gap-1"><Check className="h-3 w-3" /> Saved</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        {policies.map((policy) => (
          <Card key={policy.slug}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                {policy.title}
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(policy)} className="flex items-center justify-center h-8 w-8 rounded-full text-charcoal-lighter hover:text-secondary hover:bg-primary-light transition-colors">
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleteTarget(policy)} className="flex items-center justify-center h-8 w-8 rounded-full text-charcoal-lighter hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </CardTitle>
              <CardDescription>/policies/{policy.slug} · {policy.sections.length} section{policy.sections.length !== 1 ? "s" : ""}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-charcoal-lighter line-clamp-2">{policy.intro}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {policies.length === 0 && (
        <Card><CardContent className="p-10 text-center text-charcoal-lighter text-sm">No policy pages yet. Click &quot;Add Policy Page&quot; to create one.</CardContent></Card>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingSlug ? "Edit Policy Page" : "Add Policy Page"}</DialogTitle>
            <DialogDescription>{editingSlug ? `Editing /policies/${editingSlug}` : "Create a new policy page"}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Page Title"
                required
                value={formTitle}
                onChange={(e) => {
                  setFormTitle(e.target.value);
                  if (!slugManuallyEdited) setFormSlug(slugify(e.target.value));
                }}
                placeholder="e.g. Warranty Policy"
              />
              <div>
                <Input
                  label="URL Slug"
                  required
                  value={formSlug}
                  onChange={(e) => { setFormSlug(e.target.value); setSlugManuallyEdited(true); }}
                  placeholder="warranty"
                  disabled={!!editingSlug}
                />
                <p className="text-[10px] text-charcoal-lighter mt-1">/policies/{formSlug || "..."}</p>
              </div>
            </div>

            <Textarea
              label="Intro Paragraph"
              value={formIntro}
              onChange={(e) => setFormIntro(e.target.value)}
              placeholder="A short summary shown at the top of the page"
              className="min-h-[70px]"
            />

            <div className="space-y-3">
              <label className="block text-sm font-medium text-charcoal-light">Sections</label>
              {formSections.map((section, si) => (
                <div key={si} className="p-3 rounded-xl bg-pearl/40 border border-border/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={section.heading}
                      onChange={(e) => updateSection(si, { heading: e.target.value })}
                      placeholder="Section heading"
                      className="!h-9 flex-1 font-medium"
                    />
                    <button onClick={() => removeSection(si)} className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full text-charcoal-lighter hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 pl-2">
                    {section.body.map((line, li) => (
                      <div key={li} className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-secondary shrink-0" />
                        <Input
                          value={line}
                          onChange={(e) => updateSectionLine(si, li, e.target.value)}
                          placeholder="Bullet point text"
                          className="!h-8 text-xs flex-1"
                        />
                        <button onClick={() => removeSectionLine(si, li)} className="shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-charcoal-lighter hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addSectionLine(si)} className="text-[11px] text-secondary hover:underline flex items-center gap-1">
                      <Plus className="h-3 w-3" /> Add bullet point
                    </button>
                  </div>
                </div>
              ))}
              <AdminButton variant="outline" size="sm" className="w-full" onClick={addSection}>
                <Plus className="h-3 w-3" /> Add Section
              </AdminButton>
            </div>
          </div>

          <DialogFooter className="shrink-0">
            <button onClick={() => { setDialogOpen(false); resetForm(); }} className="px-4 py-2 text-xs text-charcoal-lighter hover:text-charcoal">Cancel</button>
            <button
              onClick={handleSave}
              disabled={!canEdit || saving || !formTitle.trim() || !formSlug.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary !text-white text-xs font-semibold hover:bg-secondary-dark hover:shadow-[0_6px_25px_rgba(122,79,160,0.3)] hover:-translate-y-[1px] active:scale-[0.96] disabled:opacity-40 transition-all duration-300"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Policy Page</DialogTitle>
            <DialogDescription>
              This will permanently remove <strong>{deleteTarget?.title}</strong> (/policies/{deleteTarget?.slug}). Any footer link pointing to it will no longer work until re-pointed elsewhere.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
