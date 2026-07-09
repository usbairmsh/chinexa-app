"use client";

import { useState, useEffect } from "react";
import { Layout, Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, Check, GripVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { useCategories } from "@/hooks/queries/use-categories";
import { STATIC_PAGES, COLLECTION_PAGES, CHAT_ACTION } from "@/lib/site-pages";
import { randomId, cn } from "@/lib/utils";
import type { FooterConfig, FooterColumn, FooterLink } from "@/types/footer";
import { DEFAULT_FOOTER_CONFIG } from "@/types/footer";
import type { PolicyPage } from "@/types/policy";

export default function AdminFooterPage() {
  const [config, setConfig] = useState<FooterConfig>(DEFAULT_FOOTER_CONFIG);
  const [policies, setPolicies] = useState<PolicyPage[]>([]);
  const { data: categories } = useCategories();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings?key=footer_config").then((r) => r.json()),
      fetch("/api/settings?key=policy_pages").then((r) => r.json()),
    ])
      .then(([footerRes, policyRes]) => {
        if (footerRes?.value?.columns?.length) setConfig(footerRes.value);
        if (Array.isArray(policyRes?.value)) setPolicies(policyRes.value);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Destination picker options — flattened into groups so admin can pick any
  // real page on the site, never type a URL by hand.
  const destinationGroups = [
    { group: "Pages", options: STATIC_PAGES },
    { group: "Collections", options: COLLECTION_PAGES },
    { group: "Categories", options: (categories || []).map((c) => ({ label: c.name, href: `/categories/${c.slug}` })) },
    { group: "Policy Pages", options: policies.map((p) => ({ label: p.title, href: `/policies/${p.slug}` })) },
    { group: "Actions", options: [CHAT_ACTION] },
  ];

  const addColumn = () => {
    setConfig((c) => ({ columns: [...c.columns, { id: randomId(), title: "New Column", links: [] }] }));
  };

  const removeColumn = (columnId: string) => {
    setConfig((c) => ({ columns: c.columns.filter((col) => col.id !== columnId) }));
  };

  const updateColumnTitle = (columnId: string, title: string) => {
    setConfig((c) => ({ columns: c.columns.map((col) => (col.id === columnId ? { ...col, title } : col)) }));
  };

  const moveColumn = (columnId: string, direction: "up" | "down") => {
    setConfig((c) => {
      const idx = c.columns.findIndex((col) => col.id === columnId);
      if ((direction === "up" && idx === 0) || (direction === "down" && idx === c.columns.length - 1)) return c;
      const next = [...c.columns];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return { columns: next };
    });
  };

  const addLink = (columnId: string) => {
    setConfig((c) => ({
      columns: c.columns.map((col) =>
        col.id === columnId
          ? { ...col, links: [...col.links, { id: randomId(), label: "New Link", href: STATIC_PAGES[0].href }] }
          : col
      ),
    }));
  };

  const removeLink = (columnId: string, linkId: string) => {
    setConfig((c) => ({
      columns: c.columns.map((col) => (col.id === columnId ? { ...col, links: col.links.filter((l) => l.id !== linkId) } : col)),
    }));
  };

  const updateLink = (columnId: string, linkId: string, patch: Partial<FooterLink>) => {
    setConfig((c) => ({
      columns: c.columns.map((col) =>
        col.id === columnId ? { ...col, links: col.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)) } : col
      ),
    }));
  };

  const moveLink = (columnId: string, linkId: string, direction: "up" | "down") => {
    setConfig((c) => ({
      columns: c.columns.map((col) => {
        if (col.id !== columnId) return col;
        const idx = col.links.findIndex((l) => l.id === linkId);
        if ((direction === "up" && idx === 0) || (direction === "down" && idx === col.links.length - 1)) return col;
        const next = [...col.links];
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
        return { ...col, links: next };
      }),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "footer_config", value: config }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
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
            <Layout className="h-6 w-6 text-secondary" /> Footer
          </h1>
          <p className="text-sm text-charcoal-lighter">Configure the columns and links shown in the website footer.</p>
        </div>
        <div className="flex gap-2">
          <AdminButton variant="outline" onClick={addColumn}><Plus className="h-3.5 w-3.5" /> Add Column</AdminButton>
          <AdminButton onClick={handleSave} disabled={saving} className={saved ? "!bg-success" : ""}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Saved!" : "Save Changes"}
          </AdminButton>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {config.columns.map((column, colIndex) => (
          <Card key={column.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-charcoal-lighter shrink-0" />
                <Input
                  value={column.title}
                  onChange={(e) => updateColumnTitle(column.id, e.target.value)}
                  className="!h-9 font-semibold"
                  placeholder="Column title"
                />
                <div className="flex flex-col shrink-0">
                  <button onClick={() => moveColumn(column.id, "up")} disabled={colIndex === 0} className="p-0.5 hover:bg-pearl rounded disabled:opacity-30 transition-colors">
                    <ChevronUp className="h-3.5 w-3.5 text-charcoal-lighter" />
                  </button>
                  <button onClick={() => moveColumn(column.id, "down")} disabled={colIndex === config.columns.length - 1} className="p-0.5 hover:bg-pearl rounded disabled:opacity-30 transition-colors">
                    <ChevronDown className="h-3.5 w-3.5 text-charcoal-lighter" />
                  </button>
                </div>
                <button
                  onClick={() => removeColumn(column.id)}
                  className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full text-charcoal-lighter hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label={`Remove ${column.title} column`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-2">
                {column.links.map((link, linkIndex) => (
                  <div key={link.id} className={cn("p-2.5 rounded-lg bg-pearl/40 space-y-1.5", link.href === "#chat" && "bg-primary-light/40")}>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={link.label}
                        onChange={(e) => updateLink(column.id, link.id, { label: e.target.value })}
                        placeholder="Link text"
                        className="!h-8 text-xs flex-1"
                      />
                      <div className="flex flex-col shrink-0">
                        <button onClick={() => moveLink(column.id, link.id, "up")} disabled={linkIndex === 0} className="p-0.5 hover:bg-white rounded disabled:opacity-30 transition-colors">
                          <ChevronUp className="h-3 w-3 text-charcoal-lighter" />
                        </button>
                        <button onClick={() => moveLink(column.id, link.id, "down")} disabled={linkIndex === column.links.length - 1} className="p-0.5 hover:bg-white rounded disabled:opacity-30 transition-colors">
                          <ChevronDown className="h-3 w-3 text-charcoal-lighter" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeLink(column.id, link.id)}
                        className="shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-charcoal-lighter hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label={`Remove ${link.label}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <Select value={link.href} onValueChange={(href) => updateLink(column.id, link.id, { href })}>
                      <SelectTrigger className="!h-8 text-xs"><SelectValue placeholder="Choose destination" /></SelectTrigger>
                      <SelectContent>
                        {destinationGroups.map((g) => g.options.length > 0 && (
                          <SelectGroup key={g.group}>
                            <SelectLabel>{g.group}</SelectLabel>
                            {g.options.map((opt) => (
                              <SelectItem key={opt.href} value={opt.href}>{opt.label}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <AdminButton variant="outline" size="sm" className="w-full" onClick={() => addLink(column.id)}>
                  <Plus className="h-3 w-3" /> Add Link
                </AdminButton>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {config.columns.length === 0 && (
        <Card><CardContent className="p-10 text-center text-charcoal-lighter text-sm">No footer columns yet. Click &quot;Add Column&quot; to start.</CardContent></Card>
      )}
    </div>
  );
}
