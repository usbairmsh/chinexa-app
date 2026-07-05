"use client";

import { useState, useEffect, useCallback } from "react";
import { Globe, Search, FileText, Link2, Code, Settings, Loader2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImageUpload } from "@/components/admin/shared/image-upload";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

const GLOBAL_PATH = "_global";

const DEFAULT_PAGES = [
  { path: "/", title: "Home — ChineXa" },
  { path: "/products", title: "All Products — ChineXa" },
  { path: "/categories/skincare", title: "Premium Skincare — ChineXa" },
  { path: "/categories/bags", title: "Luxury Bags — ChineXa" },
  { path: "/about", title: "Our Story — ChineXa" },
  { path: "/blog", title: "Beauty Blog — ChineXa" },
];

interface SeoRow {
  page_path: string;
  title?: string | null;
  meta_description?: string | null;
  og_image?: string | null;
  no_index?: number | boolean;
}

export default function AdminSeoPage() {
  const [siteTitle, setSiteTitle] = useState("ChineXa — Premium Beauty & Lifestyle");
  const [siteDescription, setSiteDescription] = useState("Discover premium skincare, luxury bags, exquisite jewelry, fine perfumes, and imported beauty products. ChineXa brings world-class beauty to Bangladesh.");
  const [ogImage, setOgImage] = useState("");

  // Tracking
  const [gaId, setGaId] = useState("");
  const [searchConsole, setSearchConsole] = useState("");
  const [metaPixel, setMetaPixel] = useState("");
  const [tiktokPixel, setTiktokPixel] = useState("");
  const [bingVerify, setBingVerify] = useState("");
  const [pinterestVerify, setPinterestVerify] = useState("");

  // Page-level index flags keyed by path
  const [pageIndex, setPageIndex] = useState<Record<string, boolean>>({});

  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savedGlobal, setSavedGlobal] = useState(false);
  const [savingTracking, setSavingTracking] = useState(false);
  const [savedTracking, setSavedTracking] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    // Global + page meta from /api/seo
    try {
      const res = await fetch("/api/seo");
      const rows = await res.json();
      if (res.ok && Array.isArray(rows)) {
        const globalRow = rows.find((r: SeoRow) => r.page_path === GLOBAL_PATH);
        if (globalRow) {
          if (globalRow.title) setSiteTitle(globalRow.title);
          if (globalRow.meta_description) setSiteDescription(globalRow.meta_description);
          if (globalRow.og_image) setOgImage(globalRow.og_image);
        }
        const idx: Record<string, boolean> = {};
        for (const p of DEFAULT_PAGES) {
          const row = rows.find((r: SeoRow) => r.page_path === p.path);
          idx[p.path] = row ? !row.no_index : true;
        }
        setPageIndex(idx);
      }
    } catch {}
    // Tracking config from settings
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
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
    } catch {
      setError("Network error — settings not saved");
    } finally {
      setSavingGlobal(false);
    }
  };

  const saveTracking = async () => {
    setSavingTracking(true); setError(""); setSavedTracking(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "tracking_config",
          value: {
            ga_id: gaId, search_console: searchConsole, meta_pixel: metaPixel,
            tiktok_pixel: tiktokPixel, bing_verify: bingVerify, pinterest_verify: pinterestVerify,
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

  const togglePageIndex = async (path: string, title: string, indexed: boolean) => {
    setPageIndex((prev) => ({ ...prev, [path]: indexed }));
    try {
      const res = await fetch("/api/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_path: path, title, no_index: !indexed }),
      });
      if (!res.ok) {
        // Revert on failure so the UI never lies about server state
        setPageIndex((prev) => ({ ...prev, [path]: !indexed }));
        setError("Failed to update indexing for " + path);
      }
    } catch {
      setPageIndex((prev) => ({ ...prev, [path]: !indexed }));
      setError("Network error — indexing not updated");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-charcoal">SEO Management</h1>
        <p className="text-sm text-charcoal-lighter">Configure search engine optimization settings for your store</p>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-2">{error}</p>
      )}

      <Tabs defaultValue="global">
        <TabsList>
          <TabsTrigger value="global">Global Settings</TabsTrigger>
          <TabsTrigger value="pages">Page Meta</TabsTrigger>
          <TabsTrigger value="schema">Schema</TabsTrigger>
          <TabsTrigger value="redirects">Redirects</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="global">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Global Meta Tags
                </CardTitle>
                <CardDescription>Default meta tags applied site-wide</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Site Title"
                  value={siteTitle}
                  onChange={(e) => setSiteTitle(e.target.value)}
                  placeholder="Your site title"
                />
                <Textarea
                  label="Meta Description"
                  value={siteDescription}
                  onChange={(e) => setSiteDescription(e.target.value)}
                  placeholder="Site description for search engines"
                />
                <ImageUpload
                  label="Default OG Image"
                  aspectRatio="video"
                  value={ogImage}
                  onChange={setOgImage}
                />
                <AdminButton onClick={saveGlobal} disabled={savingGlobal}>
                  {savingGlobal ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : savedGlobal ? <Check className="h-3.5 w-3.5 mr-1" /> : null}
                  {savedGlobal ? "Saved!" : "Save Changes"}
                </AdminButton>
              </CardContent>
            </Card>

            {/* Preview */}
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

                <h4 className="text-sm font-semibold text-charcoal mb-3">Sitemap & Robots</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">Sitemap</p>
                      <p className="text-xs text-charcoal-lighter">sitemap.xml is generated automatically from your products, categories and pages</p>
                    </div>
                    <span className="text-xs font-medium text-success">Active</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">Robots</p>
                      <p className="text-xs text-charcoal-lighter">robots.txt is generated automatically</p>
                    </div>
                    <span className="text-xs font-medium text-success">Active</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pages">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-4 w-4" /> Page-Level Meta Tags
              </CardTitle>
              <CardDescription>Control search-engine indexing per page</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30 text-left">
                      <th className="px-4 py-3 font-medium text-charcoal-lighter">Page</th>
                      <th className="px-4 py-3 font-medium text-charcoal-lighter">Meta Title</th>
                      <th className="px-4 py-3 font-medium text-charcoal-lighter">Indexed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEFAULT_PAGES.map((page) => (
                      <tr key={page.path} className="border-b border-border/20">
                        <td className="px-4 py-3 font-medium text-charcoal">{page.path}</td>
                        <td className="px-4 py-3 text-charcoal-light">{page.title}</td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={pageIndex[page.path] ?? true}
                            onCheckedChange={(v) => togglePageIndex(page.path, page.title, !!v)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schema">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Code className="h-4 w-4" /> Schema.org / Structured Data
              </CardTitle>
              <CardDescription>JSON-LD structured data generated automatically for rich search results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {["Organization", "Product", "BreadcrumbList", "FAQPage", "BlogPosting", "Review"].map((schema) => (
                  <div key={schema} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div>
                      <p className="text-sm font-medium text-charcoal">{schema}</p>
                      <p className="text-xs text-charcoal-lighter">Auto-generated</p>
                    </div>
                    <span className="text-xs font-medium text-success">Active</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redirects">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Link2 className="h-4 w-4" /> URL Redirects
              </CardTitle>
              <CardDescription>Manage 301 and 302 redirects</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-charcoal-lighter">
                Redirect management is not available yet. Contact your developer to add redirects in the server configuration.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tracking">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-4 w-4" /> Tracking & Verification
              </CardTitle>
              <CardDescription>Connect analytics and verification services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <Input
                label="Google Analytics ID"
                placeholder="G-XXXXXXXXXX"
                value={gaId}
                onChange={(e) => setGaId(e.target.value)}
              />
              <Input
                label="Google Search Console Verification"
                placeholder="Verification code"
                value={searchConsole}
                onChange={(e) => setSearchConsole(e.target.value)}
              />
              <Input
                label="Meta Pixel ID"
                placeholder="Your Meta Pixel ID"
                value={metaPixel}
                onChange={(e) => setMetaPixel(e.target.value)}
              />
              <Input
                label="TikTok Pixel ID"
                placeholder="Your TikTok Pixel ID"
                value={tiktokPixel}
                onChange={(e) => setTiktokPixel(e.target.value)}
              />
              <Input
                label="Bing Webmaster Verification"
                placeholder="Verification code"
                value={bingVerify}
                onChange={(e) => setBingVerify(e.target.value)}
              />
              <Input
                label="Pinterest Verification"
                placeholder="Verification code"
                value={pinterestVerify}
                onChange={(e) => setPinterestVerify(e.target.value)}
              />
              <AdminButton onClick={saveTracking} disabled={savingTracking}>
                {savingTracking ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : savedTracking ? <Check className="h-3.5 w-3.5 mr-1" /> : null}
                {savedTracking ? "Saved!" : "Save Tracking Settings"}
              </AdminButton>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
