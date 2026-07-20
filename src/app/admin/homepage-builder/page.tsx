"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { GripVertical, ChevronDown, ChevronUp, Save, Loader2, Check, RotateCcw, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
// Single source of truth for layout bounds — the storefront ProductSection
// clamps with the same values, so admin input limits can't drift from what
// the homepage actually renders.
import { MIN_ROWS, MAX_ROWS, MIN_COLUMNS, MAX_COLUMNS, clampRows, clampColumns } from "@/components/storefront/home/product-section";

interface SectionConfig {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  description: string;
  visible: boolean;
  order: number;
  /** Where this section's actual content is set up/edited/deleted — undefined when it's fully configured inline on this page (e.g. trust badges). */
  link?: string;
  /** Product-listing sections only: grid rows shown on the homepage. */
  rows?: number;
  /** Product-listing sections only: desktop column count. */
  columns?: number;
  /** Product-listing sections only: right-to-left auto-scroll instead of the grid. */
  scroll?: boolean;
}

interface TrustBadge {
  title: string;
  description: string;
}

interface HomepageConfig {
  sections: SectionConfig[];
  trust_badges: TrustBadge[];
}

const defaultSections: SectionConfig[] = [
  { id: "s1", type: "hero", title: "Hero Carousel", subtitle: "", description: "Full-width hero banner slider", visible: true, order: 1, link: "/admin/banners" },
  { id: "s2", type: "categories", title: "Category Showcase", subtitle: "", description: "Grid of product categories", visible: true, order: 2, link: "/admin/categories" },
  { id: "s3", type: "new_arrivals", title: "New Arrivals", subtitle: "The latest additions to our collection", description: "Latest products added to the store", visible: true, order: 3, link: "/admin/products", rows: 2, columns: 4, scroll: false },
  { id: "s4", type: "trust_badges", title: "Trust Badges", subtitle: "", description: "Authenticity, shipping, returns, support", visible: true, order: 4 },
  { id: "s5", type: "bestsellers", title: "Best Sellers", subtitle: "Loved by our customers", description: "Most popular products", visible: true, order: 5, link: "/admin/products", rows: 2, columns: 4, scroll: false },
  { id: "s6", type: "brand_story", title: "Brand Story", subtitle: "", description: "About ChineXa and our mission", visible: true, order: 6, link: "/admin/settings?tab=store" },
  { id: "s7", type: "trending", title: "Trending Now", subtitle: "What everyone is talking about", description: "Currently trending products", visible: true, order: 7, link: "/admin/products", rows: 2, columns: 4, scroll: false },
  { id: "s8", type: "preorder", title: "Pre-Order", subtitle: "Be the first to own the latest launches", description: "Upcoming product launches", visible: true, order: 8, link: "/admin/products", rows: 1, columns: 4, scroll: false },
  { id: "s9", type: "promo_banner", title: "Promo Banners", subtitle: "", description: "Promotional banner cards (set in Banners > position: promo)", visible: true, order: 9, link: "/admin/banners" },
  { id: "s10", type: "category_banner", title: "Category Banner", subtitle: "", description: "Full-width category banner (set in Banners > position: category)", visible: true, order: 10, link: "/admin/banners" },
  { id: "s11", type: "reviews", title: "Customer Reviews", subtitle: "", description: "Scrolling customer reviews", visible: true, order: 11, link: "/admin/reviews" },
  { id: "s12", type: "instagram", title: "Instagram Feed", subtitle: "", description: "Social media gallery", visible: true, order: 12, link: "/admin/settings?tab=store" },
  { id: "s13", type: "brands", title: "Our Brands", subtitle: "", description: "Auto-scrolling brands carousel", visible: true, order: 13, link: "/admin/brands" },
  { id: "s14", type: "faq", title: "FAQ", subtitle: "", description: "Frequently asked questions", visible: false, order: 14, link: "/admin/settings?tab=store" },
  { id: "s15", type: "popup_banner", title: "Popup Banner", subtitle: "", description: "Welcome popup overlay (set in Banners > position: popup)", visible: true, order: 15, link: "/admin/banners" },
];

const defaultTrustBadges: TrustBadge[] = [
  { title: "100% Authentic", description: "Every product is genuine and verified" },
  { title: "Free Shipping", description: "On orders above ৳3,000" },
  { title: "Easy Returns", description: "7-day hassle-free return policy" },
  { title: "24/7 Support", description: "We're here whenever you need us" },
];

export default function AdminHomepageBuilder() {
  const [sections, setSections] = useState<SectionConfig[]>(defaultSections);
  const [trustBadges, setTrustBadges] = useState<TrustBadge[]>(defaultTrustBadges);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load from DB
  useEffect(() => {
    fetch("/api/settings?key=homepage_config")
      .then((r) => r.json())
      .then((data) => {
        if (data?.value) {
          const config = data.value as HomepageConfig;
          if (config.sections?.length) {
            // Merge: keep saved sections + add any new default sections not yet in saved config
            // Backfill missing description/link from defaults, and ensure unique IDs
            const defaultByType = new Map(defaultSections.map((s) => [s.type, s]));
            const savedWithDesc = config.sections.map((s) => ({
              ...s,
              description: s.description || defaultByType.get(s.type)?.description || "",
              link: s.link || defaultByType.get(s.type)?.link,
              // Layout fields didn't exist in older saved configs — backfill
              // from defaults so the inputs show what the storefront renders.
              rows: s.rows ?? defaultByType.get(s.type)?.rows,
              columns: s.columns ?? defaultByType.get(s.type)?.columns,
              scroll: s.scroll ?? defaultByType.get(s.type)?.scroll,
            }));
            const savedTypes = new Set(config.sections.map((s) => s.type));
            const usedIds = new Set(savedWithDesc.map((s) => s.id));
            const newSections = defaultSections.filter((s) => !savedTypes.has(s.type));
            const maxOrder = Math.max(...savedWithDesc.map((s) => s.order), 0);
            const merged = [
              ...savedWithDesc,
              ...newSections.map((s, i) => ({
                ...s,
                // Avoid duplicate IDs — generate a new one if it already exists
                id: usedIds.has(s.id) ? `s${Date.now()}-${i}` : s.id,
                order: maxOrder + i + 1,
              })),
            ];
            setSections(merged);
          }
          if (config.trust_badges?.length) setTrustBadges(config.trust_badges);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleVisibility = (id: string) => {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, visible: !s.visible } : s));
  };

  const moveSection = (id: string, direction: "up" | "down") => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if ((direction === "up" && idx === 0) || (direction === "down" && idx === prev.length - 1)) return prev;
      const next = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const updateSectionField = (id: string, field: "title" | "subtitle", value: string) => {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
  };

  const updateSectionLayout = (id: string, patch: Partial<Pick<SectionConfig, "rows" | "columns" | "scroll">>) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const updateBadge = (index: number, field: "title" | "description", value: string) => {
    setTrustBadges((prev) => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  const handleSave = async () => {
    setSaving(true);
    const config: HomepageConfig = {
      // Clamp layout values on the way out so nothing out of range can be
      // persisted, whatever path it arrived by.
      sections: sections.map((s) =>
        s.rows !== undefined || s.columns !== undefined || s.scroll !== undefined
          ? { ...s, rows: clampRows(s.rows), columns: clampColumns(s.columns), scroll: !!s.scroll }
          : s
      ),
      trust_badges: trustBadges,
    };
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "homepage_config", value: config }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  };

  const handleReset = () => {
    // Section layout/order is structural, safe to restore to sensible
    // defaults. Trust-badge text is NOT — if an admin resets and saves
    // without editing further, this would publish demo placeholder copy to
    // every real visitor. Clear those to empty instead, so the admin has to
    // type their own real copy before it can go live.
    setSections(defaultSections);
    setTrustBadges(Array.from({ length: 4 }, () => ({ title: "", description: "" })));
  };

  // Which section types have editable title/subtitle
  const editableSections = ["new_arrivals", "bestsellers", "trending", "preorder"];

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
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Homepage Builder</h1>
          <p className="text-sm text-charcoal-lighter">Arrange, show/hide, and configure homepage sections</p>
        </div>
        <div className="flex gap-2">
          <AdminButton variant="outline" onClick={handleReset}><RotateCcw className="h-3.5 w-3.5" /> Reset</AdminButton>
          <AdminButton onClick={handleSave} disabled={saving} className={saved ? "!bg-success" : ""}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Saved!" : "Save Changes"}
          </AdminButton>
        </div>
      </div>

      {/* Trust Badges Config */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-charcoal mb-3">Trust Badges</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {trustBadges.map((badge, i) => (
              <div key={i} className="p-3 rounded-luxury bg-pearl/40 border border-border/20 space-y-2">
                <Input
                  value={badge.title}
                  onChange={(e) => updateBadge(i, "title", e.target.value)}
                  className="text-xs font-semibold"
                  placeholder="Badge title"
                />
                <Input
                  value={badge.description}
                  onChange={(e) => updateBadge(i, "description", e.target.value)}
                  className="text-[11px] text-charcoal-light"
                  placeholder="Badge description"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-charcoal px-1">Sections Order & Visibility</h3>
        {sections.map((section, index) => {
          const isExpanded = expandedSection === section.id;
          const isEditable = editableSections.includes(section.type);
          const isTrustBadge = section.type === "trust_badges";

          return (
            <motion.div
              key={section.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card className={cn("transition-opacity", !section.visible && "opacity-50")}>
              <CardContent className="p-0">
                <div className="flex items-center gap-3 p-3 sm:p-4">
                  {/* Up/Down buttons — left side */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => moveSection(section.id, "up")} disabled={index === 0} className="p-0.5 hover:bg-pearl rounded disabled:opacity-30 transition-colors active:scale-[0.96] disabled:active:scale-100">
                      <ChevronUp className="h-3.5 w-3.5 text-charcoal-lighter" />
                    </button>
                    <button onClick={() => moveSection(section.id, "down")} disabled={index === sections.length - 1} className="p-0.5 hover:bg-pearl rounded disabled:opacity-30 transition-colors active:scale-[0.96] disabled:active:scale-100">
                      <ChevronDown className="h-3.5 w-3.5 text-charcoal-lighter" />
                    </button>
                  </div>

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-secondary font-bold text-xs shrink-0">
                    {section.order}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {section.link ? (
                        <Link
                          href={section.link}
                          className="text-sm font-medium text-secondary hover:underline truncate flex items-center gap-1"
                        >
                          {section.type === "trust_badges" ? "Trust Badges" : (section.title || section.description)}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </Link>
                      ) : (
                        <h3 className="text-sm font-medium text-charcoal truncate">{section.type === "trust_badges" ? "Trust Badges" : (section.title || section.description)}</h3>
                      )}
                      <Badge variant="outline" className="text-[9px] hidden sm:inline-flex shrink-0">{section.type}</Badge>
                    </div>
                    <p className="text-xs text-charcoal-lighter truncate">{section.description}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch checked={section.visible} onCheckedChange={() => toggleVisibility(section.id)} />

                    {(isEditable || isTrustBadge) && (
                      <button
                        onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                        className={cn("p-1.5 rounded-lg transition-colors active:scale-[0.96]", isExpanded ? "bg-secondary/10 text-secondary" : "hover:bg-pearl text-charcoal-lighter")}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded config for editable sections. Trust badges also has its
                    always-visible card above — this chevron just scrolls attention
                    there rather than duplicating another editor inline. */}
                {isExpanded && isTrustBadge && (
                  <div className="px-4 pb-4 border-t border-border/20 pt-3">
                    <p className="text-xs text-charcoal-lighter">Edit the badge titles and descriptions in the <strong>Trust Badges</strong> card above.</p>
                  </div>
                )}
                {isExpanded && isEditable && (
                  <div className="px-4 pb-4 border-t border-border/20 pt-3 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Input
                        label="Section Title"
                        value={section.title}
                        onChange={(e) => updateSectionField(section.id, "title", e.target.value)}
                        placeholder="Section title"
                      />
                      <Input
                        label="Subtitle"
                        value={section.subtitle}
                        onChange={(e) => updateSectionField(section.id, "subtitle", e.target.value)}
                        placeholder="Section subtitle"
                      />
                    </div>

                    {/* Product layout: rows × columns grid, or a right-to-left
                        auto-scroll of all the section's products. */}
                    <div className="grid sm:grid-cols-3 gap-3 items-end">
                      <Input
                        type="number"
                        label={`Rows (${MIN_ROWS}–${MAX_ROWS})`}
                        min={MIN_ROWS}
                        max={MAX_ROWS}
                        value={section.scroll ? "" : String(section.rows ?? 2)}
                        placeholder={section.scroll ? "—" : undefined}
                        disabled={!!section.scroll}
                        onChange={(e) => updateSectionLayout(section.id, { rows: clampRows(Number(e.target.value)) })}
                        className="disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <Input
                        type="number"
                        label={`Columns (${MIN_COLUMNS}–${MAX_COLUMNS})`}
                        min={MIN_COLUMNS}
                        max={MAX_COLUMNS}
                        value={section.scroll ? "" : String(section.columns ?? 4)}
                        placeholder={section.scroll ? "—" : undefined}
                        disabled={!!section.scroll}
                        onChange={(e) => updateSectionLayout(section.id, { columns: clampColumns(Number(e.target.value)) })}
                        className="disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <label className="flex items-center gap-2.5 cursor-pointer h-11 px-3 rounded-luxury bg-pearl/60 border border-border/30">
                        <Checkbox
                          checked={!!section.scroll}
                          onCheckedChange={(v) => updateSectionLayout(section.id, { scroll: !!v })}
                        />
                        <span className="text-sm text-charcoal">Scroll</span>
                      </label>
                    </div>
                    <p className="text-xs text-charcoal-lighter">
                      {section.scroll
                        ? "All of this section's products auto-scroll right to left in one continuous row — rows and columns don't apply."
                        : `Shows ${clampRows(section.rows)} × ${clampColumns(section.columns)} = ${clampRows(section.rows) * clampColumns(section.columns)} products on desktop. Cards resize automatically to fit the column count; phones always show 2 columns.`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            </motion.div>
          );
        })}
      </div>

      <p className="text-xs text-charcoal-lighter text-center">Changes take effect on the storefront after saving</p>
    </div>
  );
}
