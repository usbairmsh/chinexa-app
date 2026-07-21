"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Globe, Search, FileText, Link2, Code, Settings, Loader2, Check,
  Plus, Trash2, Pencil, ExternalLink, AlertTriangle, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImageUpload } from "@/components/admin/shared/image-upload";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { FieldHelp, HelpedField } from "@/components/admin/shared/field-help";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const GLOBAL_PATH = "_global";

// Pages whose layouts read seo_metadata overrides. Dynamic pages (a specific
// product/category/brand/blog URL) honor overrides too — these are just the
// always-present ones we list up front.
const STATIC_PAGES = [
  { path: "/", label: "Homepage" },
  { path: "/products", label: "All Products" },
  { path: "/about", label: "About / Our Story" },
  { path: "/blog", label: "Blog" },
  { path: "/brands", label: "Brands" },
  { path: "/faq", label: "FAQ" },
  { path: "/contact", label: "Contact" },
  { path: "/track-order", label: "Track Order" },
];

interface DiscoveredPage {
  path: string;
  label: string;
  default_title: string;
  default_description: string;
}

interface SeoRow {
  page_path: string;
  title?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  keywords?: unknown;
  canonical_url?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  no_index?: number | boolean;
  no_follow?: number | boolean;
}

interface RedirectRow {
  id: number;
  from_path: string;
  to_path: string;
  redirect_type: number;
  is_active: boolean;
  hit_count: number;
}

interface SchemaToggle {
  key: "organization" | "website" | "product" | "breadcrumb" | "brand" | "review";
  name: string;
  where: string;
  help: string;
}

const SCHEMA_TOGGLES: SchemaToggle[] = [
  { key: "organization", name: "Organization", where: "Every storefront page", help: "Tells Google your business name, logo and location. Powers the brand knowledge panel and helps Google connect your pages to one business. Keep this ON unless you have a specific reason not to." },
  { key: "website", name: "WebSite + SearchAction", where: "Every storefront page", help: "Declares your site name and search URL to Google — enables the sitelinks search box (a search field under your result) and the correct site name in results." },
  { key: "product", name: "Product", where: "Product detail pages", help: "Sends each product's name, image, price, availability and discount to Google. This is what makes price and stock status appear directly in search results. Turning it OFF removes product rich results." },
  { key: "breadcrumb", name: "BreadcrumbList", where: "Product & brand pages", help: "Shows the page's category trail (Home › Skincare › Product) in Google results instead of a raw URL — improves how your listing reads." },
  { key: "brand", name: "Brand", where: "Brand pages", help: "Marks each brand page as the Bangladesh storefront for that brand, reinforcing local-market relevance in search." },
  { key: "review", name: "AggregateRating (Reviews)", where: "Product detail pages", help: "Adds the star rating and review count to product search results. Requires the Product schema to be ON — stars render as part of the product data." },
];

function parseKeywords(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((k): k is string => typeof k === "string");
  if (typeof raw === "string" && raw) {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

function CharCounter({ value, min, max }: { value: string; min: number; max: number }) {
  const len = value.length;
  const color = len === 0 ? "text-charcoal-lighter/50" : len > max ? "text-destructive" : len >= min ? "text-success" : "text-warning";
  return <span className={cn("text-[10px] font-medium [font-variant-numeric:tabular-nums]", color)}>{len}/{max}</span>;
}

// A page-meta edit form's field values (dialog state)
interface MetaForm {
  page_path: string;
  meta_title: string;
  meta_description: string;
  keywords: string;
  canonical_url: string;
  og_title: string;
  og_description: string;
  og_image: string;
  no_index: boolean;
  no_follow: boolean;
}

const EMPTY_FORM: MetaForm = {
  page_path: "", meta_title: "", meta_description: "", keywords: "",
  canonical_url: "", og_title: "", og_description: "", og_image: "",
  no_index: false, no_follow: false,
};

export default function AdminSeoPage() {
  // ─── Global tab state ───
  const [siteTitle, setSiteTitle] = useState("ChineXa — Premium Beauty & Lifestyle");
  const [siteDescription, setSiteDescription] = useState("Discover premium skincare, luxury bags, exquisite jewelry, fine perfumes, and imported beauty products. ChineXa brings world-class beauty to Bangladesh.");
  const [ogImage, setOgImage] = useState("");
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savedGlobal, setSavedGlobal] = useState(false);

  // ─── Page meta tab state ───
  const [seoRows, setSeoRows] = useState<SeoRow[]>([]);
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [metaIsNew, setMetaIsNew] = useState(false);
  const [metaForm, setMetaForm] = useState<MetaForm>(EMPTY_FORM);
  const [savingMeta, setSavingMeta] = useState(false);
  const [deleteMetaPath, setDeleteMetaPath] = useState<string | null>(null);
  // Auto-fetched real pages (products/categories/brands/blog + core/collections)
  const [discovered, setDiscovered] = useState<DiscoveredPage[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchSummary, setFetchSummary] = useState<string>("");
  const [pageTypeFilter, setPageTypeFilter] = useState<string>("all");

  // ─── Schema tab state ───
  const [schemaConfig, setSchemaConfig] = useState<Record<string, boolean>>({
    organization: true, website: true, product: true, breadcrumb: true, brand: true, review: true,
  });
  const [savingSchema, setSavingSchema] = useState(false);
  const [savedSchema, setSavedSchema] = useState(false);

  // ─── Redirects tab state ───
  const [redirects, setRedirects] = useState<RedirectRow[]>([]);
  const [redirectDialogOpen, setRedirectDialogOpen] = useState(false);
  const [redirectFrom, setRedirectFrom] = useState("");
  const [redirectTo, setRedirectTo] = useState("");
  const [redirectType, setRedirectType] = useState<"301" | "302">("301");
  const [savingRedirect, setSavingRedirect] = useState(false);

  // ─── Tracking tab state ───
  const [gaId, setGaId] = useState("");
  const [searchConsole, setSearchConsole] = useState("");
  const [metaPixel, setMetaPixel] = useState("");
  const [tiktokPixel, setTiktokPixel] = useState("");
  const [bingVerify, setBingVerify] = useState("");
  const [pinterestVerify, setPinterestVerify] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);
  const [savedTracking, setSavedTracking] = useState(false);

  const [error, setError] = useState("");

  const loadSeoRows = useCallback(async () => {
    try {
      const res = await fetch("/api/seo");
      const rows = await res.json();
      if (res.ok && Array.isArray(rows)) {
        setSeoRows(rows);
        const globalRow = rows.find((r: SeoRow) => r.page_path === GLOBAL_PATH);
        if (globalRow) {
          if (globalRow.title) setSiteTitle(globalRow.title);
          if (globalRow.meta_description) setSiteDescription(globalRow.meta_description);
          if (globalRow.og_image) setOgImage(globalRow.og_image);
        }
      }
    } catch {}
  }, []);

  const loadRedirects = useCallback(async () => {
    try {
      const res = await fetch("/api/redirects");
      const rows = await res.json();
      if (res.ok && Array.isArray(rows)) setRedirects(rows);
    } catch {}
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings?key=tracking_config");
      const data = await res.json();
      const cfg = data?.value ?? data?.tracking_config ?? data;
      if (res.ok && cfg && typeof cfg === "object") {
        if (cfg.ga_id) setGaId(cfg.ga_id);
        if (cfg.search_console) setSearchConsole(cfg.search_console);
        if (cfg.meta_pixel) setMetaPixel(cfg.meta_pixel);
        if (cfg.tiktok_pixel) setTiktokPixel(cfg.tiktok_pixel);
        if (cfg.bing_verify) setBingVerify(cfg.bing_verify);
        if (cfg.pinterest_verify) setPinterestVerify(cfg.pinterest_verify);
      }
    } catch {}
    try {
      const res = await fetch("/api/settings?key=schema_config");
      const data = await res.json();
      const cfg = data?.value;
      if (res.ok && cfg && typeof cfg === "object") {
        setSchemaConfig((prev) => ({ ...prev, ...cfg }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadSeoRows();
    loadRedirects();
    loadSettings();
  }, [loadSeoRows, loadRedirects, loadSettings]);

  // ─── Global save ───
  const saveGlobal = async () => {
    setSavingGlobal(true); setError(""); setSavedGlobal(false);
    try {
      const res = await fetch("/api/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_path: GLOBAL_PATH,
          title: siteTitle,
          meta_title: siteTitle,
          meta_description: siteDescription,
          og_title: siteTitle,
          og_description: siteDescription,
          og_image: ogImage || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save global SEO settings");
        return;
      }
      setSavedGlobal(true);
      setTimeout(() => setSavedGlobal(false), 2000);
      loadSeoRows();
    } catch {
      setError("Network error — settings not saved");
    } finally {
      setSavingGlobal(false);
    }
  };

  // Pull every real storefront URL + its default meta, so the table lists
  // actual products/categories/brands/blog posts rather than a hardcoded 8.
  const autoFetchPages = async () => {
    setFetching(true); setError("");
    try {
      const res = await fetch("/api/seo/discover");
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to fetch pages"); return; }
      setDiscovered(Array.isArray(data.pages) ? data.pages : []);
      const c = data.counts || {};
      setFetchSummary(`Found ${c.total} pages — ${c.products} products, ${c.categories} categories, ${c.brands} brands, ${c.blog} blog posts.`);
    } catch {
      setError("Network error — could not fetch pages");
    } finally {
      setFetching(false);
    }
  };

  // ─── Page meta: rows shown = discovered pages (once fetched) or the static
  // fallback set, each merged with any saved override row from the DB, plus
  // any custom paths added by hand that aren't in either list. ───
  const rowFor = (path: string) => seoRows.find((r) => r.page_path === path);
  const defaultFor = (path: string) => discovered.find((d) => d.path === path);
  const basePages: { path: string; label: string }[] =
    discovered.length > 0
      ? discovered.map((d) => ({ path: d.path, label: d.label }))
      : STATIC_PAGES.map((p) => ({ path: p.path, label: p.label ?? "Core" }));
  const basePaths = new Set(basePages.map((p) => p.path));
  const customRows = seoRows.filter(
    (r) => r.page_path !== GLOBAL_PATH && !basePaths.has(r.page_path)
  );
  const allTypes = Array.from(new Set(basePages.map((p) => p.label)));
  const pageList: { path: string; label: string; row?: SeoRow }[] = [
    ...basePages
      .filter((p) => pageTypeFilter === "all" || p.label === pageTypeFilter)
      .map((p) => ({ ...p, row: rowFor(p.path) })),
    ...(pageTypeFilter === "all" || pageTypeFilter === "Custom"
      ? customRows.map((r) => ({ path: r.page_path, label: "Custom", row: r }))
      : []),
  ];

  const openMetaDialog = (path?: string) => {
    setError("");
    if (!path) {
      setMetaIsNew(true);
      setMetaForm(EMPTY_FORM);
    } else {
      const row = rowFor(path);
      const def = defaultFor(path);
      setMetaIsNew(false);
      // Pre-fill title/description from a saved override if one exists,
      // otherwise from the auto-fetched default — so editing a fetched page
      // starts with its live values already in the fields, ready to tweak.
      setMetaForm({
        page_path: path,
        meta_title: (row?.meta_title as string) || (row?.title as string) || def?.default_title || "",
        meta_description: (row?.meta_description as string) || def?.default_description || "",
        keywords: parseKeywords(row?.keywords).join(", "),
        canonical_url: (row?.canonical_url as string) || "",
        og_title: (row?.og_title as string) || "",
        og_description: (row?.og_description as string) || "",
        og_image: (row?.og_image as string) || "",
        no_index: !!row?.no_index,
        no_follow: !!row?.no_follow,
      });
    }
    setMetaDialogOpen(true);
  };

  const saveMeta = async () => {
    const path = metaForm.page_path.trim();
    if (!path.startsWith("/")) {
      setError("Page path must start with / — e.g. /about");
      return;
    }
    setSavingMeta(true); setError("");
    try {
      const res = await fetch("/api/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_path: path,
          title: metaForm.meta_title || null,
          meta_title: metaForm.meta_title || null,
          meta_description: metaForm.meta_description || null,
          keywords: metaForm.keywords ? metaForm.keywords.split(",").map((s) => s.trim()).filter(Boolean) : null,
          canonical_url: metaForm.canonical_url || null,
          og_title: metaForm.og_title || null,
          og_description: metaForm.og_description || null,
          og_image: metaForm.og_image || null,
          no_index: metaForm.no_index,
          no_follow: metaForm.no_follow,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save page meta");
        return;
      }
      setMetaDialogOpen(false);
      loadSeoRows();
    } catch {
      setError("Network error — page meta not saved");
    } finally {
      setSavingMeta(false);
    }
  };

  // Quick indexed toggle from the table. Sends the row's FULL existing field
  // set — the API is a whole-row upsert, so a partial body would silently
  // null out every other field (the old implementation's data-loss bug).
  const togglePageIndex = async (path: string, indexed: boolean) => {
    const row = rowFor(path);
    try {
      const res = await fetch("/api/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_path: path,
          title: row?.title || null,
          meta_title: row?.meta_title || null,
          meta_description: row?.meta_description || null,
          keywords: parseKeywords(row?.keywords).length ? parseKeywords(row?.keywords) : null,
          canonical_url: row?.canonical_url || null,
          og_title: row?.og_title || null,
          og_description: row?.og_description || null,
          og_image: row?.og_image || null,
          no_index: !indexed,
          no_follow: !!row?.no_follow,
        }),
      });
      if (!res.ok) {
        setError("Failed to update indexing for " + path);
        return;
      }
      loadSeoRows();
    } catch {
      setError("Network error — indexing not updated");
    }
  };

  const deleteMeta = async () => {
    if (!deleteMetaPath) return;
    try {
      const res = await fetch(`/api/seo?page_path=${encodeURIComponent(deleteMetaPath)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to remove override");
      }
      setDeleteMetaPath(null);
      loadSeoRows();
    } catch {
      setError("Network error — override not removed");
      setDeleteMetaPath(null);
    }
  };

  // ─── Schema save ───
  const saveSchema = async () => {
    setSavingSchema(true); setError(""); setSavedSchema(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "schema_config", value: schemaConfig }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save schema settings");
        return;
      }
      setSavedSchema(true);
      setTimeout(() => setSavedSchema(false), 2000);
    } catch {
      setError("Network error — schema settings not saved");
    } finally {
      setSavingSchema(false);
    }
  };

  // ─── Redirects ───
  const saveRedirect = async () => {
    if (!redirectFrom.trim() || !redirectTo.trim()) {
      setError("Both the old path and the destination are required");
      return;
    }
    setSavingRedirect(true); setError("");
    try {
      const res = await fetch("/api/redirects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_path: redirectFrom, to_path: redirectTo, redirect_type: Number(redirectType) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save redirect");
        return;
      }
      setRedirectDialogOpen(false);
      setRedirectFrom(""); setRedirectTo(""); setRedirectType("301");
      loadRedirects();
    } catch {
      setError("Network error — redirect not saved");
    } finally {
      setSavingRedirect(false);
    }
  };

  const toggleRedirect = async (id: number, active: boolean) => {
    setRedirects((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: active } : r)));
    try {
      const res = await fetch(`/api/redirects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active }),
      });
      if (!res.ok) {
        setRedirects((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: !active } : r)));
        setError("Failed to update redirect");
      }
    } catch {
      setRedirects((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: !active } : r)));
      setError("Network error — redirect not updated");
    }
  };

  const deleteRedirect = async (id: number) => {
    try {
      const res = await fetch(`/api/redirects/${id}`, { method: "DELETE" });
      if (!res.ok) setError("Failed to delete redirect");
      loadRedirects();
    } catch {
      setError("Network error — redirect not deleted");
    }
  };

  // ─── Tracking save ───
  const saveTracking = async () => {
    setSavingTracking(true); setError(""); setSavedTracking(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "tracking_config",
          value: {
            ga_id: gaId.trim(), search_console: searchConsole.trim(), meta_pixel: metaPixel.trim(),
            tiktok_pixel: tiktokPixel.trim(), bing_verify: bingVerify.trim(), pinterest_verify: pinterestVerify.trim(),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save tracking settings");
        return;
      }
      setSavedTracking(true);
      setTimeout(() => setSavedTracking(false), 2000);
    } catch {
      setError("Network error — settings not saved");
    } finally {
      setSavingTracking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-charcoal">SEO Management</h1>
        <p className="text-sm text-charcoal-lighter">Configure how your store appears in search engines and social shares</p>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <Tabs defaultValue="global">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="global">Global Settings</TabsTrigger>
          <TabsTrigger value="pages">Page Meta</TabsTrigger>
          <TabsTrigger value="schema">Schema</TabsTrigger>
          <TabsTrigger value="redirects">Redirects</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
        </TabsList>

        {/* ═══════════ GLOBAL ═══════════ */}
        <TabsContent value="global">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Global Meta Tags
                </CardTitle>
                <CardDescription>The site-wide defaults every page falls back to when it has no meta of its own</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <HelpedField
                  label="Site Title"
                  right={<CharCounter value={siteTitle} min={30} max={60} />}
                  help={
                    <>
                      <p><strong>What it is:</strong> the clickable headline Google shows for your homepage, and the default browser-tab text.</p>
                      <p><strong>Requirement:</strong> 30–60 characters. Put what you sell first, your brand name last — e.g. &ldquo;Korean Skincare &amp; Beauty — ChineXa&rdquo;.</p>
                    </>
                  }
                >
                  <Input value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} placeholder="Your site title" />
                </HelpedField>

                <HelpedField
                  label="Meta Description"
                  right={<CharCounter value={siteDescription} min={70} max={160} />}
                  help={
                    <>
                      <p><strong>What it is:</strong> the grey summary text under your title in Google results. It doesn&rsquo;t directly affect ranking, but it strongly affects whether people click.</p>
                      <p><strong>Requirement:</strong> 70–160 characters. Mention what you sell, where you deliver, and one reason to buy from you (e.g. cash on delivery, authentic products).</p>
                    </>
                  }
                >
                  <Textarea value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)} placeholder="Site description for search engines" />
                </HelpedField>

                <HelpedField
                  label="Default Share Image (OG Image)"
                  help={
                    <>
                      <p><strong>What it is:</strong> the preview image shown when your site is shared on Facebook, WhatsApp, Messenger or LinkedIn and the page has no image of its own.</p>
                      <p><strong>Requirement:</strong> 1200×630 pixels (roughly 1.91:1), under 1&nbsp;MB, with your logo/branding clearly visible on small screens.</p>
                    </>
                  }
                >
                  <ImageUpload aspectRatio="video" value={ogImage} onChange={setOgImage} folder="seo" />
                </HelpedField>

                <AdminButton onClick={saveGlobal} disabled={savingGlobal}>
                  {savingGlobal ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : savedGlobal ? <Check className="h-3.5 w-3.5 mr-1" /> : null}
                  {savedGlobal ? "Saved!" : "Save Changes"}
                </AdminButton>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-4 w-4" /> Search Preview
                </CardTitle>
                <CardDescription>How your site appears in Google</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border/50 p-4 bg-white">
                  <p className="text-blue-600 text-lg font-medium hover:underline cursor-pointer truncate">
                    {siteTitle || "Your Site Title"}
                  </p>
                  <p className="text-green-700 text-sm">https://chinexabd.com</p>
                  <p className="text-sm text-charcoal-light mt-1 line-clamp-2">
                    {siteDescription || "Your site description will appear here..."}
                  </p>
                </div>

                <Separator className="my-6" />

                <div className="flex items-center gap-1.5 mb-3">
                  <h4 className="text-sm font-semibold text-charcoal">Sitemap &amp; Robots</h4>
                  <FieldHelp title="Sitemap & Robots">
                    <p><strong>Sitemap</strong> is the machine-readable list of every page Google should crawl — products, categories, brands and blog posts are added automatically as you create them.</p>
                    <p><strong>Robots.txt</strong> tells crawlers which areas to stay out of (admin, checkout, APIs). Both are generated automatically — nothing to maintain by hand.</p>
                  </FieldHelp>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">Sitemap</p>
                      <p className="text-xs text-charcoal-lighter">Generated automatically from products, categories, brands and pages</p>
                    </div>
                    <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-secondary hover:text-secondary-dark transition-colors">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">Robots</p>
                      <p className="text-xs text-charcoal-lighter">Generated automatically with the correct crawl rules</p>
                    </div>
                    <a href="/robots.txt" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-secondary hover:text-secondary-dark transition-colors">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════ PAGE META ═══════════ */}
        <TabsContent value="pages">
          <div className="space-y-4">
            <Card className="bg-pearl/40 border-border/40">
              <CardContent className="p-4 text-xs text-charcoal-light leading-relaxed">
                <p className="font-semibold text-charcoal text-sm mb-1">What is Page Meta?</p>
                <p>
                  Every page carries hidden tags — a <strong>meta title</strong> (the headline Google shows), a{" "}
                  <strong>meta description</strong> (the summary under it) and <strong>social share tags</strong> (the preview
                  when shared on Facebook/WhatsApp). Each page ships with sensible defaults; this tab lets you override them
                  per page. Fields you leave blank keep the page&rsquo;s default, so you only override what you want to change.
                  Click <strong>Auto-Fetch Pages</strong> to pull in every real product, category, brand and blog URL with its
                  current default meta — then edit and save only the ones you want to change.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Page-Level Meta Tags
                  </CardTitle>
                  <CardDescription>Override any page&rsquo;s title, description, share preview and indexing</CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <AdminButton variant="outline" size="sm" onClick={autoFetchPages} disabled={fetching}>
                    {fetching ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                    Auto-Fetch Pages
                  </AdminButton>
                  <AdminButton size="sm" onClick={() => openMetaDialog()}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Page
                  </AdminButton>
                </div>
              </CardHeader>
              <CardContent>
                {(fetchSummary || allTypes.length > 1) && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    {fetchSummary && <p className="text-xs text-success flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> {fetchSummary}</p>}
                    {discovered.length > 0 && (
                      <div className="sm:ml-auto w-full sm:w-44">
                        <Select value={pageTypeFilter} onValueChange={setPageTypeFilter}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All page types</SelectItem>
                            {allTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            {customRows.length > 0 && <SelectItem value="Custom">Custom</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left">
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter">Page</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter">Meta Title</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter">
                          <span className="inline-flex items-center gap-1">
                            Indexed
                            <FieldHelp title="Indexed">
                              <p><strong>ON:</strong> search engines may list this page in results (normal).</p>
                              <p><strong>OFF:</strong> adds a <code>noindex</code> tag politely asking Google to drop the page from results — use for thin or utility pages you don&rsquo;t want ranked. It does not password-protect anything.</p>
                            </FieldHelp>
                          </span>
                        </th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageList.map(({ path, label, row }) => {
                        const def = defaultFor(path);
                        return (
                        <tr key={path} className="border-b border-border/20 hover:bg-pearl/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-charcoal break-all">{path}</p>
                              <Badge variant="outline" className="text-[8px] shrink-0">{label}</Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-charcoal-light max-w-[280px]">
                            {row?.meta_title || row?.title ? (
                              <span className="line-clamp-1">{row.meta_title || row.title}</span>
                            ) : def ? (
                              <span className="line-clamp-1 text-charcoal-lighter">{def.default_title} <span className="text-[9px] italic">(default)</span></span>
                            ) : (
                              <span className="text-charcoal-lighter/60 italic">Using page default</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Switch
                              checked={!row?.no_index}
                              onCheckedChange={(v) => togglePageIndex(path, !!v)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openMetaDialog(path)}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-lighter hover:text-secondary hover:bg-primary-light transition-colors active:scale-[0.96]"
                                aria-label={`Edit meta for ${path}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {row && (
                                <button
                                  onClick={() => setDeleteMetaPath(path)}
                                  className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-lighter hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-[0.96]"
                                  aria-label={`Remove override for ${path}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════ SCHEMA ═══════════ */}
        <TabsContent value="schema">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Code className="h-4 w-4" /> Schema.org / Structured Data
              </CardTitle>
              <CardDescription>
                Machine-readable data that unlocks rich results in Google — prices, star ratings, breadcrumbs and your
                brand panel. Generated automatically; each type can be switched off if ever needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {SCHEMA_TOGGLES.map((s) => (
                  <div key={s.key} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div className="min-w-0 mr-3">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-charcoal">{s.name}</p>
                        <FieldHelp title={s.name}><p>{s.help}</p></FieldHelp>
                      </div>
                      <p className="text-xs text-charcoal-lighter">{s.where}</p>
                    </div>
                    <Switch
                      checked={schemaConfig[s.key] !== false}
                      onCheckedChange={(v) => setSchemaConfig((prev) => ({ ...prev, [s.key]: !!v }))}
                    />
                  </div>
                ))}
              </div>
              <AdminButton onClick={saveSchema} disabled={savingSchema}>
                {savingSchema ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : savedSchema ? <Check className="h-3.5 w-3.5 mr-1" /> : null}
                {savedSchema ? "Saved!" : "Save Schema Settings"}
              </AdminButton>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ REDIRECTS ═══════════ */}
        <TabsContent value="redirects">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link2 className="h-4 w-4" /> URL Redirects
                </CardTitle>
                <CardDescription>
                  Send visitors (and Google) from old or dead URLs to the right place — e.g. after renaming a product or
                  removing a page. Live pages always win: a redirect only fires when the old URL no longer exists.
                </CardDescription>
              </div>
              <AdminButton size="sm" onClick={() => { setError(""); setRedirectDialogOpen(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Redirect
              </AdminButton>
            </CardHeader>
            <CardContent>
              {redirects.length === 0 ? (
                <EmptyState
                  icon={Link2}
                  title="No redirects yet"
                  description="Add one when you rename or remove a page, so its old URL keeps working instead of showing a 404."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left">
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter">From (old URL)</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter">To (destination)</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter">Type</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter [font-variant-numeric:tabular-nums]">Hits</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter">Active</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redirects.map((r) => (
                        <tr key={r.id} className="border-b border-border/20 hover:bg-pearl/50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-charcoal">{r.from_path}</td>
                          <td className="px-4 py-3 font-mono text-xs text-charcoal-light max-w-[240px] truncate">{r.to_path}</td>
                          <td className="px-4 py-3">
                            <Badge variant={r.redirect_type === 301 ? "secondary" : "outline"} className="text-[9px]">
                              {r.redirect_type === 301 ? "301 Permanent" : "302 Temporary"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-charcoal-lighter [font-variant-numeric:tabular-nums]">{r.hit_count}</td>
                          <td className="px-4 py-3">
                            <Switch checked={r.is_active} onCheckedChange={(v) => toggleRedirect(r.id, !!v)} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              <button
                                onClick={() => deleteRedirect(r.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-lighter hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-[0.96]"
                                aria-label={`Delete redirect from ${r.from_path}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ TRACKING ═══════════ */}
        <TabsContent value="tracking">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-4 w-4" /> Tracking &amp; Verification
              </CardTitle>
              <CardDescription>
                Paste an ID and it goes live site-wide automatically — analytics scripts and verification tags are injected
                on every page for you, no code changes needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <HelpedField
                label="Google Analytics ID"
                help={
                  <>
                    <p><strong>What it is:</strong> connects Google Analytics 4 so you can see visitors, traffic sources and sales funnels.</p>
                    <p><strong>Where to find it:</strong> Google Analytics → Admin → Data streams → your web stream → Measurement ID. Format: <code>G-XXXXXXXXXX</code>.</p>
                    <p>Once saved, the tracking script is added to every page automatically.</p>
                  </>
                }
              >
                <Input placeholder="G-XXXXXXXXXX" value={gaId} onChange={(e) => setGaId(e.target.value)} />
              </HelpedField>

              <HelpedField
                label="Google Search Console Verification"
                help={
                  <>
                    <p><strong>What it is:</strong> proves to Google that you own this site, unlocking Search Console (indexing status, search keywords, sitemap submission).</p>
                    <p><strong>Where to find it:</strong> Search Console → add property → choose the <em>HTML tag</em> method → copy only the long <code>content=&quot;...&quot;</code> value, not the whole tag.</p>
                  </>
                }
              >
                <Input placeholder="Verification code" value={searchConsole} onChange={(e) => setSearchConsole(e.target.value)} />
              </HelpedField>

              <HelpedField
                label="Meta Pixel ID"
                help={
                  <>
                    <p><strong>What it is:</strong> enables Facebook &amp; Instagram ad tracking — measure ad results and retarget store visitors.</p>
                    <p><strong>Where to find it:</strong> Meta Events Manager → Data sources → your pixel → the numeric ID (e.g. <code>1234567890</code>).</p>
                  </>
                }
              >
                <Input placeholder="Your Meta Pixel ID" value={metaPixel} onChange={(e) => setMetaPixel(e.target.value)} />
              </HelpedField>

              <HelpedField
                label="TikTok Pixel ID"
                help={
                  <>
                    <p><strong>What it is:</strong> the same idea as the Meta Pixel, for TikTok ads.</p>
                    <p><strong>Where to find it:</strong> TikTok Ads Manager → Assets → Events → Web Events → your pixel ID.</p>
                  </>
                }
              >
                <Input placeholder="Your TikTok Pixel ID" value={tiktokPixel} onChange={(e) => setTiktokPixel(e.target.value)} />
              </HelpedField>

              <HelpedField
                label="Bing Webmaster Verification"
                help={
                  <>
                    <p><strong>What it is:</strong> verifies ownership with Microsoft Bing (also powers Yahoo and DuckDuckGo results).</p>
                    <p><strong>Where to find it:</strong> Bing Webmaster Tools → add site → HTML meta tag method → copy the <code>content</code> value.</p>
                  </>
                }
              >
                <Input placeholder="Verification code" value={bingVerify} onChange={(e) => setBingVerify(e.target.value)} />
              </HelpedField>

              <HelpedField
                label="Pinterest Verification"
                help={
                  <>
                    <p><strong>What it is:</strong> claims your website on Pinterest so pins of your products show your brand and drive analytics.</p>
                    <p><strong>Where to find it:</strong> Pinterest Business → Settings → Claimed accounts → Claim website → copy the <code>content</code> value from the meta tag.</p>
                  </>
                }
              >
                <Input placeholder="Verification code" value={pinterestVerify} onChange={(e) => setPinterestVerify(e.target.value)} />
              </HelpedField>

              <AdminButton onClick={saveTracking} disabled={savingTracking}>
                {savingTracking ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : savedTracking ? <Check className="h-3.5 w-3.5 mr-1" /> : null}
                {savedTracking ? "Saved!" : "Save Tracking Settings"}
              </AdminButton>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════ PAGE META EDIT DIALOG ═══════════ */}
      <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{metaIsNew ? "Add Page Override" : `Edit Meta — ${metaForm.page_path}`}</DialogTitle>
            <DialogDescription>
              Fields left blank keep the page&rsquo;s built-in default — only fill what you want to change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {metaIsNew && (
              <HelpedField
                label="Page Path"
                required
                help={
                  <>
                    <p><strong>What it is:</strong> the page&rsquo;s URL path exactly as it appears in the address bar, starting with <code>/</code>.</p>
                    <p><strong>Examples:</strong> <code>/about</code>, <code>/products/vitamin-c-serum</code>, <code>/categories/skincare</code>.</p>
                  </>
                }
              >
                <Input placeholder="/example-page" value={metaForm.page_path} onChange={(e) => setMetaForm((f) => ({ ...f, page_path: e.target.value }))} />
              </HelpedField>
            )}

            <HelpedField
              label="Meta Title"
              right={<CharCounter value={metaForm.meta_title} min={30} max={60} />}
              help={
                <>
                  <p><strong>What it is:</strong> the clickable headline Google shows for this page, and its browser-tab text.</p>
                  <p><strong>Requirement:</strong> 30–60 characters, most important keywords first, brand name at the end.</p>
                </>
              }
            >
              <Input placeholder="Leave blank to keep the page's default" value={metaForm.meta_title} onChange={(e) => setMetaForm((f) => ({ ...f, meta_title: e.target.value }))} />
            </HelpedField>

            <HelpedField
              label="Meta Description"
              right={<CharCounter value={metaForm.meta_description} min={70} max={160} />}
              help={
                <>
                  <p><strong>What it is:</strong> the summary text under the title in Google results — your one chance to win the click.</p>
                  <p><strong>Requirement:</strong> 70–160 characters with a concrete reason to click (price, authenticity, delivery).</p>
                </>
              }
            >
              <Textarea placeholder="Leave blank to keep the page's default" value={metaForm.meta_description} onChange={(e) => setMetaForm((f) => ({ ...f, meta_description: e.target.value }))} />
            </HelpedField>

            <HelpedField
              label="Keywords"
              help={
                <>
                  <p><strong>What it is:</strong> comma-separated topic keywords for this page.</p>
                  <p><strong>Note:</strong> Google ignores this tag nowadays — it&rsquo;s optional and safe to leave blank. Never keyword-stuff.</p>
                </>
              }
            >
              <Input placeholder="korean skincare, serum, vitamin c" value={metaForm.keywords} onChange={(e) => setMetaForm((f) => ({ ...f, keywords: e.target.value }))} />
            </HelpedField>

            <HelpedField
              label="Canonical URL"
              help={
                <>
                  <p><strong>What it is:</strong> declares the single &ldquo;official&rdquo; URL when this page&rsquo;s content also exists at another address, so Google credits the right one.</p>
                  <p><strong>Requirement:</strong> a full URL (e.g. <code>https://chinexabd.com/products</code>). <strong>Leave blank normally</strong> — every page already sets its own correct canonical.</p>
                </>
              }
            >
              <Input placeholder="Leave blank unless this page duplicates another" value={metaForm.canonical_url} onChange={(e) => setMetaForm((f) => ({ ...f, canonical_url: e.target.value }))} />
            </HelpedField>

            <Separator />

            <HelpedField
              label="Share Title (OG Title)"
              help={
                <>
                  <p><strong>What it is:</strong> the headline shown when this page is shared on Facebook, WhatsApp or Messenger. Falls back to the meta title when blank.</p>
                  <p><strong>Tip:</strong> can be more casual/emotional than the search title — it&rsquo;s talking to friends&rsquo; feeds, not a search query.</p>
                </>
              }
            >
              <Input placeholder="Leave blank to reuse the meta title" value={metaForm.og_title} onChange={(e) => setMetaForm((f) => ({ ...f, og_title: e.target.value }))} />
            </HelpedField>

            <HelpedField
              label="Share Description (OG Description)"
              help={
                <>
                  <p><strong>What it is:</strong> the text under the share headline on social platforms. Falls back to the meta description when blank.</p>
                </>
              }
            >
              <Textarea placeholder="Leave blank to reuse the meta description" value={metaForm.og_description} onChange={(e) => setMetaForm((f) => ({ ...f, og_description: e.target.value }))} />
            </HelpedField>

            <HelpedField
              label="Share Image (OG Image)"
              help={
                <>
                  <p><strong>What it is:</strong> the preview image for social shares of this page.</p>
                  <p><strong>Requirement:</strong> 1200×630 pixels, under 1&nbsp;MB. Falls back to the global share image when blank.</p>
                </>
              }
            >
              <ImageUpload aspectRatio="video" value={metaForm.og_image} onChange={(v) => setMetaForm((f) => ({ ...f, og_image: v }))} folder="seo" />
            </HelpedField>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-charcoal-light">Hide from search results (noindex)</p>
                <FieldHelp title="noindex">
                  <p>Asks search engines to drop this page from results. The page stays publicly reachable — this is not privacy protection, just search visibility control.</p>
                </FieldHelp>
              </div>
              <Switch checked={metaForm.no_index} onCheckedChange={(v) => setMetaForm((f) => ({ ...f, no_index: !!v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-charcoal-light">Don&rsquo;t follow links (nofollow)</p>
                <FieldHelp title="nofollow">
                  <p>Asks search engines not to pass ranking credit through links on this page. Rarely needed — leave OFF unless the page is full of untrusted/user-submitted links.</p>
                </FieldHelp>
              </div>
              <Switch checked={metaForm.no_follow} onCheckedChange={(v) => setMetaForm((f) => ({ ...f, no_follow: !!v }))} />
            </div>
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setMetaDialogOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={saveMeta} disabled={savingMeta || !metaForm.page_path.trim()}>
              {savingMeta ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
              Save Page Meta
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ DELETE OVERRIDE CONFIRM ═══════════ */}
      <Dialog open={!!deleteMetaPath} onOpenChange={(o) => !o && setDeleteMetaPath(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove override?</DialogTitle>
            <DialogDescription>
              {deleteMetaPath} will go back to its built-in default title, description and share preview. Nothing is
              deleted from the live page itself.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteMetaPath(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={deleteMeta}>Remove Override</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ ADD REDIRECT DIALOG ═══════════ */}
      <Dialog open={redirectDialogOpen} onOpenChange={setRedirectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Redirect</DialogTitle>
            <DialogDescription>Point an old or dead URL at its new home.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <HelpedField
              label="From (old URL path)"
              required
              help={
                <>
                  <p><strong>What it is:</strong> the old/dead path to catch, starting with <code>/</code> — e.g. <code>/summer-sale</code> or <code>/products/old-product-name</code>.</p>
                  <p><strong>Note:</strong> redirects only fire for URLs that no longer exist — a live page always wins over a redirect, so you can&rsquo;t accidentally break a working page.</p>
                </>
              }
            >
              <Input placeholder="/old-page" value={redirectFrom} onChange={(e) => setRedirectFrom(e.target.value)} />
            </HelpedField>

            <HelpedField
              label="To (destination)"
              required
              help={
                <>
                  <p><strong>What it is:</strong> where visitors and search engines get sent instead.</p>
                  <p><strong>Format:</strong> an internal path (<code>/products</code>) or a full external URL (<code>https://example.com/page</code>).</p>
                </>
              }
            >
              <Input placeholder="/new-page" value={redirectTo} onChange={(e) => setRedirectTo(e.target.value)} />
            </HelpedField>

            <HelpedField
              label="Redirect Type"
              help={
                <>
                  <p><strong>301 Permanent:</strong> tells Google the move is forever — the old URL&rsquo;s ranking transfers to the new one. Use this in almost all cases.</p>
                  <p><strong>302 Temporary:</strong> tells Google the old URL will return — ranking stays on the old URL. Only for short-lived moves (e.g. a seasonal campaign).</p>
                </>
              }
            >
              <Select value={redirectType} onValueChange={(v) => setRedirectType(v as "301" | "302")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="301">301 — Permanent (recommended)</SelectItem>
                  <SelectItem value="302">302 — Temporary</SelectItem>
                </SelectContent>
              </Select>
            </HelpedField>
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setRedirectDialogOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={saveRedirect} disabled={savingRedirect}>
              {savingRedirect ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
              Add Redirect
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
