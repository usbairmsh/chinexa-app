"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Eye, X, Plus, Trash2,
  ImagePlus, Tag, Globe, Sparkles, Package, BarChart3, Loader2, Copy, Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/admin/shared/image-upload";
import { ImagePositionEditor } from "@/components/admin/shared/image-position-editor";
import { cn } from "@/lib/utils";
import { COUNTRIES } from "@/lib/countries";

type VariantRow = {
  id: string; type: "size" | "color" | "shade" | "weight";
  name: string; value: string; hex: string;
  price: string; compare_price: string;
  stock: string; min_stock: string; max_stock: string; sku: string;
};

type ImageRow = { id: string; url: string; alt: string; variant_id: string; focal_point: string };

export default function EditProductPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<"basic" | "media" | "variants" | "seo">("basic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string; children: { id: string; name: string }[] }[]>([]);

  // Form state
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [fullDesc, setFullDesc] = useState("");
  const [weight, setWeight] = useState("");
  const [origin, setOrigin] = useState("");
  const [tags, setTags] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [howToUse, setHowToUse] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");
  const [seoPromptOpen, setSeoPromptOpen] = useState(false);
  const [seoPromptCopied, setSeoPromptCopied] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const buildSeoPrompt = () => {
    const catName = dbCategories.find((c) => c.id === categoryId)?.name || "";
    const validVariants = variants.filter((v) => v.name && v.price);
    const prices = validVariants.map((v) => Number(v.price)).filter((p) => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const priceDisplay = minPrice === maxPrice || prices.length <= 1 ? (minPrice ? `৳${minPrice}` : "") : `৳${minPrice} — ৳${maxPrice}`;
    const comparePrices = validVariants.map((v) => Number(v.compare_price)).filter((p) => p > 0);
    const maxCompare = comparePrices.length > 0 ? Math.max(...comparePrices) : 0;
    const discount = maxCompare > 0 && minPrice > 0 ? Math.round((1 - minPrice / maxCompare) * 100) : 0;

    const lines = [
      "You are an expert e-commerce SEO specialist. Analyze the following product details and generate:",
      "1. An SEO Title (max 60 characters)",
      "2. A Meta Description (exactly 150-160 characters)",
      "",
      "=== PRODUCT DETAILS ===",
      `Product Name: ${productName}`,
      catName ? `Category: ${catName}` : "",
      subcategory ? `Subcategory: ${subcategory}` : "",
      priceDisplay ? `Price: ${priceDisplay}` : "",
      discount > 0 ? `Discount: Up to ${discount}% off` : "",
      origin ? `Country of Origin: ${origin}` : "",
      weight ? `Weight/Size: ${weight}` : "",
      shortDesc ? `Short Description: ${shortDesc}` : "",
      fullDesc ? `Full Description: ${fullDesc}` : "",
      ingredients ? `Key Ingredients: ${ingredients}` : "",
      tags ? `Tags: ${tags}` : "",
      validVariants.length > 1 ? `Available Variants: ${validVariants.map((v) => `${v.name} (${v.type}, ৳${v.price})`).join(", ")}` : "",
      "",
      "=== STORE CONTEXT ===",
      "Store: ChineXa (chinexabd.com) — Premium beauty & lifestyle store in Bangladesh",
      "Target Audience: Women in Bangladesh looking for authentic beauty products",
      "Shipping: Free delivery on orders over ৳3,000. Cash on delivery available.",
      "USP: Authentic imported products, 7-day returns, verified genuine items",
      "",
      "=== SEO REQUIREMENTS ===",
      "- Title must include the product name and end with '| ChineXa'",
      "- Title should include a high-value keyword (e.g., origin country for imported items, key ingredient for skincare)",
      "- Description must naturally include the starting price in ৳ (BDT)",
      "- Description should mention one trust signal (free delivery / COD / authentic / genuine)",
      "- Description must be action-oriented (start with a verb like Shop, Discover, Get, Try)",
      "- Use keywords that Bangladeshi shoppers would actually search for",
      "- Do NOT use generic filler words. Every word must add SEO value.",
      "",
      "Respond in this exact format:",
      "SEO Title: [your title here]",
      "Meta Description: [your description here]",
    ];
    return lines.filter(Boolean).join("\n");
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(buildSeoPrompt());
    setSeoPromptCopied(true);
    setTimeout(() => setSeoPromptCopied(false), 2000);
  };
  const [isFeatured, setIsFeatured] = useState(false);
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [images, setImages] = useState<ImageRow[]>([]);

  // Load categories + product data
  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setDbCategories(data.map((c: Record<string, unknown>) => ({
        id: c.id as string, name: c.name as string,
        children: Array.isArray(c.children) ? (c.children as Record<string, unknown>[]).map((s) => ({ id: s.id as string, name: s.name as string })) : [],
      })));
    }).catch(() => {});

    fetch(`/api/products/${id}`).then((r) => r.json()).then((p) => {
      if (p.error) { setLoading(false); return; }
      setProductName(p.name || "");
      setSku(p.sku || "");
      setShortDesc(p.short_description || "");
      setFullDesc(p.description || "");
      setWeight(p.weight || "");
      setOrigin(p.country_of_origin || "");
      setTags(Array.isArray(p.tags) ? p.tags.join(", ") : "");
      setIngredients(p.ingredients || "");
      setHowToUse(p.how_to_use || "");
      setCategoryId(p.category_id || "");
      setSubcategory(p.subcategory || "");
      setSeoTitle(p.seo_title || "");
      setSeoDesc(p.seo_description || "");
      setIsActive(!!p.is_active);
      setIsFeatured(!!p.is_featured);
      setSelectedBadges(Array.isArray(p.badges) ? p.badges : []);
      // Build images — try to match with variants by image URL
      const loadedImages: ImageRow[] = (p.images || []).map((img: Record<string, unknown>, i: number) => {
        const matchedVariant = (p.variants || []).find((v: Record<string, unknown>) => v.image && v.image === img.url);
        return { id: `img-${i}`, url: img.url as string, alt: (img.alt as string) || "", variant_id: matchedVariant ? `v-${(p.variants || []).indexOf(matchedVariant)}` : "", focal_point: (matchedVariant?.focal_point as string) || "" };
      });
      if (loadedImages.length === 0) loadedImages.push({ id: "img-0", url: "", alt: "", variant_id: "", focal_point: "" });
      setImages(loadedImages);
      const basePrice = Number(p.price) || 0;
      const loadedVariants = (p.variants || []).map((v: Record<string, unknown>, i: number) => ({
        id: `v-${i}`, type: (v.type as VariantRow["type"]) || "size",
        name: (v.name as string) || "", value: (v.value as string) || "",
        hex: (v.hex as string) || "",
        price: String(basePrice + (Number(v.price_adjustment) || 0)),
        compare_price: i === 0 && p.compare_at_price ? String(p.compare_at_price) : "",
        stock: String(v.stock || 0), min_stock: String(p.min_stock || 10), max_stock: String(p.max_stock || 100),
        sku: (v.sku as string) || "",
      }));
      // Ensure at least one variant exists
      if (loadedVariants.length === 0) {
        loadedVariants.push({ id: `v-0`, type: "size" as const, name: "", value: "", hex: "", price: String(basePrice), compare_price: p.compare_at_price ? String(p.compare_at_price) : "", stock: String(p.stock_quantity || 0), min_stock: String(p.min_stock || 10), max_stock: String(p.max_stock || 100), sku: p.sku || "" });
      }
      setVariants(loadedVariants);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const toggleBadge = (badge: string) => setSelectedBadges((prev) => prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge]);
  const addVariant = () => setVariants([...variants, { id: `v-${Date.now()}`, type: "size", name: "", value: "", hex: "", price: "", compare_price: "", stock: "0", min_stock: "10", max_stock: "100", sku: "" }]);
  const addImage = () => setImages([...images, { id: `img-${Date.now()}`, url: "", alt: "", variant_id: "", focal_point: "" }]);
  const removeImage = (iid: string) => setImages(images.filter((i) => i.id !== iid));
  const removeVariant = (vid: string) => setVariants(variants.filter((v) => v.id !== vid));
  const updateVariant = (vid: string, field: keyof VariantRow, value: string) => setVariants(variants.map((v) => v.id === vid ? { ...v, [field]: value } : v));

  const handleSave = async () => {
    if (!productName.trim()) { setError("Product name is required"); return; }
    const firstVariant = variants[0];
    if (!firstVariant?.name.trim()) { setError("At least one variant with a name is required"); return; }
    if (!firstVariant?.price) { setError("Variant price is required"); return; }
    setError(""); setSaving(true);
    const basePrice = Number(firstVariant.price) || 0;
    const totalStock = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
    try {
      const payload = {
        name: productName.trim(), sku: sku.trim() || firstVariant.sku,
        short_description: shortDesc.trim(), description: fullDesc.trim(),
        price: basePrice, compare_at_price: firstVariant.compare_price ? Number(firstVariant.compare_price) : null,
        stock_quantity: totalStock, min_stock: Number(firstVariant.min_stock) || 10, max_stock: Number(firstVariant.max_stock) || 100,
        weight: weight.trim() || null, country_of_origin: origin || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        ingredients: ingredients.trim() || null, how_to_use: howToUse.trim() || null,
        category_id: categoryId || null,
        category_name: dbCategories.find((c) => c.id === categoryId)?.name || null,
        subcategory: subcategory.trim() || null,
        seo_title: seoTitle.trim() || null, seo_description: seoDesc.trim() || null,
        is_active: isActive, is_featured: isFeatured, badges: selectedBadges,
        images: images.filter((img) => img.url).map((img) => ({ url: img.url, alt: img.alt, variant_id: img.variant_id || null, focal_point: img.focal_point || null })),
        variants: variants.filter((v) => v.name).map((v) => {
          const linkedImg = images.find((img) => img.variant_id === v.id && img.url);
          return {
            name: v.name, type: v.type, value: v.value || v.name,
            hex: v.hex || null, price_adjustment: (Number(v.price) || 0) - basePrice,
            stock: Number(v.stock) || 0, sku: v.sku,
            image: linkedImg?.url || null, focal_point: linkedImg?.focal_point || null,
          };
        }),
      };
      const res = await fetch(`/api/products/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed"); }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const tabs = [
    { id: "basic" as const, label: "Basic Info", icon: Package },
    { id: "variants" as const, label: "Variants & Stock", icon: Tag },
    { id: "media" as const, label: "Media", icon: ImagePlus },
    { id: "seo" as const, label: "SEO", icon: BarChart3 },
  ];

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/products" className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-charcoal">Edit Product</h1>
            <p className="text-xs text-charcoal-lighter">{productName || "Loading..."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AdminButton variant="outline" size="sm" onClick={() => window.open(`/products/${sku}`, "_blank")}><Eye className="h-3.5 w-3.5" /> Preview</AdminButton>
          <AdminButton size="sm" onClick={handleSave} disabled={saving} className={saved ? "!bg-success hover:!bg-success" : ""}>
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
          </AdminButton>
        </div>
      </div>

      {saved && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">
          <Save className="h-4 w-4" /> Product updated successfully!
        </motion.div>
      )}
      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          <X className="h-4 w-4" /> {error}
        </motion.div>
      )}

      <div className="flex gap-1 bg-pearl/60 p-1 rounded-xl">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn("flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === tab.id ? "bg-white text-charcoal shadow-card" : "text-charcoal-lighter hover:text-charcoal")}>
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          {activeTab === "basic" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Product Information</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Input label="Product Name" placeholder="Product name" value={productName} onChange={(e) => setProductName(e.target.value)} />
                  <Input label="SKU" placeholder="SK-0001" value={sku} onChange={(e) => setSku(e.target.value)} />
                  <Textarea label="Short Description" placeholder="Brief summary..." className="min-h-[80px]" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} />
                  <Textarea label="Full Description" placeholder="Detailed description..." className="min-h-[150px]" value={fullDesc} onChange={(e) => setFullDesc(e.target.value)} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-secondary" /> Origin & Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Select value={origin} onValueChange={setOrigin}>
                      <SelectTrigger><SelectValue placeholder="Country of Origin" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.name}>
                            <span className="flex items-center gap-2">{c.flag} {c.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input label="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
                  </div>
                  <Textarea label="Ingredients" className="min-h-[80px]" value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
                  <Textarea label="How to Use" className="min-h-[80px]" value={howToUse} onChange={(e) => setHowToUse(e.target.value)} />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Variants, Media & Stock */}
          {activeTab === "variants" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div><CardTitle className="text-base">Product Variants</CardTitle><CardDescription>Size, color, or other variations with individual pricing & stock</CardDescription></div>
                  <AdminButton size="sm" onClick={addVariant}><Plus className="h-3.5 w-3.5" /> Add Variant</AdminButton>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                      {variants.map((variant, i) => (
                        <div key={variant.id} className="rounded-xl border border-border/30 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 bg-pearl/50 border-b border-border/20">
                            <span className="text-xs font-bold text-charcoal">Variant {i + 1} {i === 0 && <span className="text-[9px] text-secondary font-normal ml-1">(default)</span>}</span>
                            {variants.length > 1 && (
                              <button onClick={() => removeVariant(variant.id)} className="p-1 rounded-full hover:bg-destructive/10 text-charcoal-lighter hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                            )}
                          </div>
                          <div className="p-4 space-y-4">
                            <div>
                              <p className="text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider mb-2">Variant Info</p>
                              <div className="grid sm:grid-cols-3 gap-3">
                                <Select value={variant.type} onValueChange={(v) => updateVariant(variant.id, "type", v)}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="size">Size</SelectItem><SelectItem value="color">Color</SelectItem>
                                    <SelectItem value="shade">Shade</SelectItem><SelectItem value="weight">Weight</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input placeholder="Name * (e.g., 50ml)" value={variant.name} onChange={(e) => updateVariant(variant.id, "name", e.target.value)} />
                                <Input placeholder="Display Value" value={variant.value} onChange={(e) => updateVariant(variant.id, "value", e.target.value)} />
                              </div>
                              {variant.type === "color" && (
                                <div className="flex items-center gap-2 mt-2">
                                  <input type="color" value={variant.hex || "#C0392B"} onChange={(e) => updateVariant(variant.id, "hex", e.target.value)} className="h-9 w-9 rounded-lg border border-border cursor-pointer" />
                                  <span className="text-xs text-charcoal-lighter font-mono">{variant.hex || "#C0392B"}</span>
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider mb-2">Pricing</p>
                              <div className="grid sm:grid-cols-2 gap-3">
                                <Input label="Price (৳) *" placeholder="2500" type="number" value={variant.price} onChange={(e) => updateVariant(variant.id, "price", e.target.value)} />
                                <Input label="Compare at Price (৳)" placeholder="3200 (optional)" type="number" value={variant.compare_price} onChange={(e) => updateVariant(variant.id, "compare_price", e.target.value)} />
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider mb-2">Inventory</p>
                              <div className="grid sm:grid-cols-2 gap-3">
                                <Input label="SKU" value={variant.sku} onChange={(e) => updateVariant(variant.id, "sku", e.target.value)} />
                                <Input label="Stock Quantity" placeholder="0" type="number" value={variant.stock} onChange={(e) => updateVariant(variant.id, "stock", e.target.value)} />
                              </div>
                              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                                <Input label="Min Stock (Low Alert)" placeholder="10" type="number" value={variant.min_stock} onChange={(e) => updateVariant(variant.id, "min_stock", e.target.value)} />
                                <Input label="Max Stock (Overstock Alert)" placeholder="100" type="number" value={variant.max_stock} onChange={(e) => updateVariant(variant.id, "max_stock", e.target.value)} />
                              </div>
                            </div>

                          </div>
                        </div>
                      ))}
                    </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Media */}
          {activeTab === "media" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Product Images</CardTitle>
                  <CardDescription>Add images and optionally link them to a variant. First image is the main display image.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {images.map((img, i) => (
                      <div key={img.id} className="p-4 rounded-xl border border-border/30 bg-pearl/20">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-charcoal">Image {i + 1} {i === 0 && <span className="text-[9px] text-secondary font-normal ml-1">(main)</span>}</span>
                          <button onClick={() => removeImage(img.id)} className="p-1 rounded-full hover:bg-destructive/10 text-charcoal-lighter hover:text-destructive transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <ImageUpload value={img.url} onChange={(url) => { const u = [...images]; u[i].url = url; setImages(u); }} aspectRatio="square" productId={id} imageIndex={String(i).padStart(4, "0")} />
                          <div className="space-y-3">
                            <Input label="Alt Text" placeholder="Describe the image" value={img.alt} onChange={(e) => { const u = [...images]; u[i].alt = e.target.value; setImages(u); }} />
                            <div>
                              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Link to Variant</label>
                              <Select value={img.variant_id} onValueChange={(v) => { const u = [...images]; u[i].variant_id = v; setImages(u); }}>
                                <SelectTrigger><SelectValue placeholder="No variant (general image)" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">No variant (general image)</SelectItem>
                                  {variants.filter((v) => v.name).map((v) => (
                                    <SelectItem key={v.id} value={v.id}>{v.name} ({v.type})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-[10px] text-charcoal-lighter mt-1">When a customer selects this variant, this image will be shown.</p>
                            </div>
                            {img.url && (
                              <ImagePositionEditor
                                imageUrl={img.url}
                                value={img.focal_point}
                                onChange={(val) => { const u = [...images]; u[i].focal_point = val; setImages(u); }}
                                aspectRatio="square"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {images.length < 8 && (
                      <button onClick={addImage} className="w-full py-6 rounded-xl border-2 border-dashed border-border/40 hover:border-secondary/40 hover:bg-primary-light/20 transition-all flex items-center justify-center gap-2 text-charcoal-lighter hover:text-secondary">
                        <Plus className="h-5 w-5" /> <span className="text-sm font-medium">Add Image</span>
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* SEO */}
          {activeTab === "seo" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-secondary" /> SEO</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-charcoal-lighter">Paste from ChatGPT / Gemini, or write manually</p>
                    <button type="button" onClick={() => setSeoPromptOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary text-[11px] font-medium hover:bg-secondary/20 transition-colors">
                      <Copy className="h-3 w-3" /> Copy for AI
                    </button>
                  </div>
                  <Input label="SEO Title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
                  <div>
                    <Textarea label="Meta Description" className="min-h-[80px]" value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} />
                    <p className={cn("text-[10px] mt-1 text-right", seoDesc.length === 0 ? "text-charcoal-lighter" : seoDesc.length >= 150 && seoDesc.length <= 160 ? "text-success font-medium" : seoDesc.length > 160 ? "text-destructive" : "text-warning")}>
                      {seoDesc.length}/160 chars {seoDesc.length >= 150 && seoDesc.length <= 160 ? "— Perfect!" : seoDesc.length > 160 ? "— Too long" : seoDesc.length > 0 ? "— Aim for 150-160" : ""}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-charcoal-lighter uppercase tracking-wider mb-2">Google Search Preview</p>
                    <div className="p-4 rounded-xl border border-border/30 bg-white">
                      <p className="text-blue-600 text-base font-medium truncate">{seoTitle || productName || "Product Name"}</p>
                      <p className="text-green-700 text-xs">chinexabd.com/products/{productName ? productName.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "") : "product-slug"}</p>
                      <p className="text-sm text-charcoal-light mt-1 line-clamp-2">{seoDesc || shortDesc || "Your meta description will appear here..."}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Status</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium text-charcoal">Active</p><p className="text-[10px] text-charcoal-lighter">Visible on storefront</p></div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium text-charcoal">Featured</p><p className="text-[10px] text-charcoal-lighter">Show on homepage</p></div>
                <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Category</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSubcategory(""); }}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {dbCategories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {(() => {
                const subs = dbCategories.find((c) => c.id === categoryId)?.children || [];
                return subs.length > 0 ? (
                  <Select value={subcategory} onValueChange={setSubcategory}>
                    <SelectTrigger><SelectValue placeholder="Subcategory (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {subs.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : null;
              })()}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-secondary" /> Badges</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {["new", "sale", "bestseller", "preorder", "limited", "trending"].map((badge) => (
                  <button key={badge} onClick={() => toggleBadge(badge)}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize",
                      selectedBadges.includes(badge) ? "bg-secondary text-white border-secondary" : "bg-white text-charcoal-lighter border-border hover:border-charcoal hover:text-charcoal")}>
                    {badge === "preorder" ? "Pre-order" : badge}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SEO Prompt Modal */}
      <Dialog open={seoPromptOpen} onOpenChange={setSeoPromptOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-secondary" /> AI SEO Prompt</DialogTitle>
            <DialogDescription>Copy this prompt and paste it in ChatGPT, Gemini, or Claude to generate SEO title &amp; description</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2">
            <pre className="whitespace-pre-wrap text-xs text-charcoal bg-pearl/60 rounded-xl p-4 border border-border/30 font-mono leading-relaxed select-all">
              {buildSeoPrompt()}
            </pre>
          </div>
          <div className="flex justify-end gap-2 pt-2 shrink-0">
            <button onClick={() => setSeoPromptOpen(false)} className="px-4 py-2 text-xs text-charcoal-lighter hover:text-charcoal transition-colors">Close</button>
            <button onClick={handleCopyPrompt} className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all", seoPromptCopied ? "bg-success text-white" : "bg-charcoal text-white hover:bg-secondary")}>
              {seoPromptCopied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy Prompt</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
