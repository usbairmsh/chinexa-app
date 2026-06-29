"use client";

import { useState } from "react";
import { Globe, Search, FileText, Link2, Code, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImageUpload } from "@/components/admin/shared/image-upload";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export default function AdminSeoPage() {
  const [siteTitle, setSiteTitle] = useState("ChineXa — Premium Beauty & Lifestyle");
  const [siteDescription, setSiteDescription] = useState("Discover premium skincare, luxury bags, exquisite jewelry, fine perfumes, and imported beauty products. ChineXa brings world-class beauty to Bangladesh.");
  const [gaId, setGaId] = useState("");
  const [metaPixel, setMetaPixel] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-charcoal">SEO Management</h1>
        <p className="text-sm text-charcoal-lighter">Configure search engine optimization settings for your store</p>
      </div>

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
                />
                <AdminButton>Save Changes</AdminButton>
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
                  <p className="text-green-700 text-sm">https://chinexa.com</p>
                  <p className="text-sm text-charcoal-light mt-1 line-clamp-2">
                    {siteDescription || "Your site description will appear here..."}
                  </p>
                </div>

                <Separator className="my-6" />

                <h4 className="text-sm font-semibold text-charcoal mb-3">Sitemap & Robots</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">Auto-generate Sitemap</p>
                      <p className="text-xs text-charcoal-lighter">Automatically update sitemap.xml</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">Allow Indexing</p>
                      <p className="text-xs text-charcoal-lighter">Allow search engines to index your site</p>
                    </div>
                    <Switch defaultChecked />
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
              <CardDescription>Configure meta tags for individual pages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30 text-left">
                      <th className="px-4 py-3 font-medium text-charcoal-lighter">Page</th>
                      <th className="px-4 py-3 font-medium text-charcoal-lighter">Meta Title</th>
                      <th className="px-4 py-3 font-medium text-charcoal-lighter hidden md:table-cell">Indexed</th>
                      <th className="px-4 py-3 font-medium text-charcoal-lighter w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { path: "/", title: "Home — ChineXa" },
                      { path: "/products", title: "All Products — ChineXa" },
                      { path: "/categories/skincare", title: "Premium Skincare — ChineXa" },
                      { path: "/categories/bags", title: "Luxury Bags — ChineXa" },
                      { path: "/about", title: "Our Story — ChineXa" },
                      { path: "/blog", title: "Beauty Blog — ChineXa" },
                    ].map((page) => (
                      <tr key={page.path} className="border-b border-border/20">
                        <td className="px-4 py-3 font-medium text-charcoal">{page.path}</td>
                        <td className="px-4 py-3 text-charcoal-light">{page.title}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <Switch defaultChecked />
                        </td>
                        <td className="px-4 py-3">
                          <AdminButton variant="ghost" size="sm">Edit</AdminButton>
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
              <CardDescription>Configure JSON-LD structured data for rich search results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {["Organization", "Product", "BreadcrumbList", "FAQPage", "BlogPosting", "Review"].map((schema) => (
                  <div key={schema} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div>
                      <p className="text-sm font-medium text-charcoal">{schema}</p>
                      <p className="text-xs text-charcoal-lighter">Auto-generated</p>
                    </div>
                    <Switch defaultChecked />
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
              <p className="text-sm text-charcoal-lighter mb-4">No redirects configured yet.</p>
              <AdminButton>
                Add Redirect
              </AdminButton>
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
              />
              <Input
                label="Bing Webmaster Verification"
                placeholder="Verification code"
              />
              <Input
                label="Pinterest Verification"
                placeholder="Verification code"
              />
              <AdminButton>Save Tracking Settings</AdminButton>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
