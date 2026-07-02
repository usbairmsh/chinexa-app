"use client";

import { useState, useEffect } from "react";
import { GripVertical, ChevronDown, ChevronUp, Save, Loader2, Check, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SectionConfig {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  description: string;
  visible: boolean;
  order: number;
}

interface TrustBadge {
  title: string;
  description: string;
}

interface HomepageConfig {
  sections: SectionConfig[];
  announcement: { visible: boolean; text: string; phone: string };
  trust_badges: TrustBadge[];
}

const defaultSections: SectionConfig[] = [
  { id: "s1", type: "hero", title: "Hero Carousel", subtitle: "", description: "Full-width hero banner slider", visible: true, order: 1 },
  { id: "s2", type: "categories", title: "Category Showcase", subtitle: "", description: "Grid of product categories", visible: true, order: 2 },
  { id: "s3", type: "new_arrivals", title: "New Arrivals", subtitle: "The latest additions to our collection", description: "Latest products added to the store", visible: true, order: 3 },
  { id: "s4", type: "trust_badges", title: "Trust Badges", subtitle: "", description: "Authenticity, shipping, returns, support", visible: true, order: 4 },
  { id: "s5", type: "bestsellers", title: "Best Sellers", subtitle: "Loved by our customers", description: "Most popular products", visible: true, order: 5 },
  { id: "s6", type: "brand_story", title: "Brand Story", subtitle: "", description: "About ChineXa and our mission", visible: true, order: 6 },
  { id: "s7", type: "trending", title: "Trending Now", subtitle: "What everyone is talking about", description: "Currently trending products", visible: true, order: 7 },
  { id: "s8", type: "preorder", title: "Pre-Order", subtitle: "Be the first to own the latest launches", description: "Upcoming product launches", visible: true, order: 8 },
  { id: "s9", type: "promo_banner", title: "Promo Banners", subtitle: "", description: "Promotional banner cards (set in Banners > position: promo)", visible: true, order: 9 },
  { id: "s10", type: "category_banner", title: "Category Banner", subtitle: "", description: "Full-width category banner (set in Banners > position: category)", visible: true, order: 10 },
  { id: "s11", type: "reviews", title: "Customer Reviews", subtitle: "", description: "Scrolling customer reviews", visible: true, order: 11 },
  { id: "s12", type: "instagram", title: "Instagram Feed", subtitle: "", description: "Social media gallery", visible: true, order: 12 },
  { id: "s13", type: "brands", title: "Our Brands", subtitle: "", description: "Auto-scrolling brands carousel", visible: true, order: 13 },
  { id: "s14", type: "faq", title: "FAQ", subtitle: "", description: "Frequently asked questions", visible: false, order: 14 },
  { id: "s15", type: "popup_banner", title: "Popup Banner", subtitle: "", description: "Welcome popup overlay (set in Banners > position: popup)", visible: true, order: 15 },
];

const defaultTrustBadges: TrustBadge[] = [
  { title: "100% Authentic", description: "Every product is genuine and verified" },
  { title: "Free Shipping", description: "On orders above ৳3,000" },
  { title: "Easy Returns", description: "7-day hassle-free return policy" },
  { title: "24/7 Support", description: "We're here whenever you need us" },
];

export default function AdminHomepageBuilder() {
  const [sections, setSections] = useState<SectionConfig[]>(defaultSections);
  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const [announcementText, setAnnouncementText] = useState("Free shipping on orders above ৳3,000 | Use code WELCOME10 for 10% off");
  const [announcementPhone, setAnnouncementPhone] = useState("+880 1700-000000");
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
            // Also backfill missing description from defaults
            const defaultByType = new Map(defaultSections.map((s) => [s.type, s]));
            const savedWithDesc = config.sections.map((s) => ({
              ...s,
              description: s.description || defaultByType.get(s.type)?.description || "",
            }));
            const savedTypes = new Set(config.sections.map((s) => s.type));
            const newSections = defaultSections.filter((s) => !savedTypes.has(s.type));
            const maxOrder = Math.max(...savedWithDesc.map((s) => s.order), 0);
            const merged = [...savedWithDesc, ...newSections.map((s, i) => ({ ...s, order: maxOrder + i + 1 }))];
            setSections(merged);
          }
          if (config.announcement) {
            setAnnouncementVisible(config.announcement.visible);
            setAnnouncementText(config.announcement.text);
            if (config.announcement.phone) setAnnouncementPhone(config.announcement.phone);
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

  const updateBadge = (index: number, field: "title" | "description", value: string) => {
    setTrustBadges((prev) => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  const handleSave = async () => {
    setSaving(true);
    const config: HomepageConfig = {
      sections,
      announcement: { visible: announcementVisible, text: announcementText, phone: announcementPhone },
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
    setSections(defaultSections);
    setAnnouncementVisible(true);
    setAnnouncementText("Free shipping on orders above ৳3,000 | Use code WELCOME10 for 10% off");
    setAnnouncementPhone("+880 1700-000000");
    setTrustBadges(defaultTrustBadges);
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
      <div className="flex items-center justify-between">
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

      {/* Announcement Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-charcoal">Announcement Bar</h3>
            <Switch checked={announcementVisible} onCheckedChange={setAnnouncementVisible} />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-charcoal-lighter mb-1">Announcement Text</label>
              <input
                type="text"
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="Enter announcement text..."
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-charcoal focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
              />
            </div>
            <div>
              <label className="block text-xs text-charcoal-lighter mb-1">Phone Number</label>
              <input
                type="text"
                value={announcementPhone}
                onChange={(e) => setAnnouncementPhone(e.target.value)}
                placeholder="+880 1700-000000"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-charcoal focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
              />
            </div>
          </div>
          <p className="text-[10px] text-charcoal-lighter mt-1.5">This bar appears at the top of the website on every page</p>
        </CardContent>
      </Card>

      {/* Trust Badges Config */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-charcoal mb-3">Trust Badges</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {trustBadges.map((badge, i) => (
              <div key={i} className="p-3 rounded-xl bg-pearl/40 border border-border/20 space-y-2">
                <input
                  type="text"
                  value={badge.title}
                  onChange={(e) => updateBadge(i, "title", e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-charcoal focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary/20"
                  placeholder="Badge title"
                />
                <input
                  type="text"
                  value={badge.description}
                  onChange={(e) => updateBadge(i, "description", e.target.value)}
                  className="w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-[11px] text-charcoal-light focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary/20"
                  placeholder="Badge description"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-charcoal px-1">Sections Order & Visibility</h3>
        {sections.map((section, index) => {
          const isExpanded = expandedSection === section.id;
          const isEditable = editableSections.includes(section.type);
          const isTrustBadge = section.type === "trust_badges";

          return (
            <Card key={section.id} className={cn("transition-opacity", !section.visible && "opacity-50")}>
              <CardContent className="p-0">
                <div className="flex items-center gap-3 p-3 sm:p-4">
                  {/* Up/Down buttons — left side */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => moveSection(section.id, "up")} disabled={index === 0} className="p-0.5 hover:bg-pearl rounded disabled:opacity-30 transition-colors">
                      <ChevronUp className="h-3.5 w-3.5 text-charcoal-lighter" />
                    </button>
                    <button onClick={() => moveSection(section.id, "down")} disabled={index === sections.length - 1} className="p-0.5 hover:bg-pearl rounded disabled:opacity-30 transition-colors">
                      <ChevronDown className="h-3.5 w-3.5 text-charcoal-lighter" />
                    </button>
                  </div>

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-secondary font-bold text-xs shrink-0">
                    {section.order}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-charcoal">{section.type === "trust_badges" ? "Trust Badges" : (section.title || section.description)}</h3>
                      <Badge variant="outline" className="text-[9px] hidden sm:inline-flex">{section.type}</Badge>
                    </div>
                    <p className="text-xs text-charcoal-lighter truncate">{section.description}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch checked={section.visible} onCheckedChange={() => toggleVisibility(section.id)} />

                    {(isEditable || isTrustBadge) && (
                      <button
                        onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                        className={cn("p-1.5 rounded-lg transition-colors", isExpanded ? "bg-secondary/10 text-secondary" : "hover:bg-pearl text-charcoal-lighter")}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded config for editable sections */}
                {isExpanded && isEditable && (
                  <div className="px-4 pb-4 border-t border-border/20 pt-3">
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
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-charcoal-lighter text-center">Changes take effect on the storefront after saving</p>
    </div>
  );
}
