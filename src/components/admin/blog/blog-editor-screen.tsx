"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Send, Save, Loader2, ChevronDown, ChevronRight, Search, Clock, Eye, Pencil } from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/admin/shared/image-upload";
import { BlogEditor } from "@/components/admin/blog/blog-editor";
import { BlogContent } from "@/components/storefront/blog/blog-content";
import { useFlushUploads, cleanupReplacedImage } from "@/components/admin/shared/pending-uploads";
import { slugify, formatDateShort } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { BlogPost } from "@/types/blog";

// Basic sanitizer for the preview (content is admin-authored, this is
// defense-in-depth so a stray <script> can't run in the preview pane).
function sanitize(html: string): string {
  return (html || "")
    .replace(/<\s*(script|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

export function BlogEditorScreen({ post }: { post: BlogPost | null }) {
  const router = useRouter();
  const flushUploads = useFlushUploads();
  const editing = !!post;

  const [title, setTitle] = useState(post?.title || "");
  const [slug, setSlug] = useState(post?.slug || "");
  const [autoSlug, setAutoSlug] = useState(!post);
  const [excerpt, setExcerpt] = useState(post?.excerpt || "");
  const [content, setContent] = useState(post?.content || "");
  const [image, setImage] = useState(post?.featured_image || "");
  const [category, setCategory] = useState(post?.category || "");
  const [tags, setTags] = useState((post?.tags || []).join(", "));
  const [author, setAuthor] = useState(post?.author_name || "ChineXa Team");
  const [readingTime, setReadingTime] = useState(String(post?.reading_time || 5));
  // Hidden-from-readers SEO fields.
  const [seoTitle, setSeoTitle] = useState(post?.seo_title || "");
  const [seoDescription, setSeoDescription] = useState(post?.seo_description || "");
  const [seoKeywords, setSeoKeywords] = useState(post?.seo_keywords || "");
  const [seoOpen, setSeoOpen] = useState(false);

  const [busy, setBusy] = useState<"publish" | "draft" | null>(null);
  const [error, setError] = useState("");
  // Mobile only: which pane is showing (both show side-by-side on lg+).
  const [mobilePane, setMobilePane] = useState<"editor" | "preview">("editor");

  // Inline images uploaded THIS session. On a successful save we clear it; if
  // the editor unmounts without saving, any uploaded image not present in the
  // final content is deleted so abandoned posts don't leave orphaned files.
  const sessionImages = useRef<string[]>([]);
  const committed = useRef(false);
  const latestContent = useRef(content);
  useEffect(() => { latestContent.current = content; }, [content]);

  useEffect(() => {
    return () => {
      if (committed.current || sessionImages.current.length === 0) return;
      // Only delete images that didn't end up in the (unsaved) content.
      const html = latestContent.current || "";
      for (const url of sessionImages.current) {
        const path = url.replace(/^https?:\/\/[^/]+/, ""); // strip origin → /api/uploads/…
        if (!html.includes(url) && !html.includes(path)) {
          fetch(`/api/upload?url=${encodeURIComponent(path)}`, { method: "DELETE" }).catch(() => {});
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTitle = (v: string) => { setTitle(v); if (autoSlug) setSlug(slugify(v)); };

  // Nothing is persisted until the user acts. `publish` decides is_published.
  const save = async (publish: boolean) => {
    if (!title.trim()) { setError("Title is required"); return; }
    setError(""); setBusy(publish ? "publish" : "draft");
    try {
      const uploaded = await flushUploads();
      const featured = uploaded.blog_featured_image ?? image;
      const payload = {
        title: title.trim(),
        slug: slug.trim() || slugify(title),
        excerpt: excerpt.trim() || null,
        content: content.trim() || null,
        featured_image: featured || null,
        category: category.trim() || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        author_name: author.trim() || "ChineXa Team",
        reading_time: Number(readingTime) || 5,
        is_published: publish,
        seo_title: seoTitle.trim() || null,
        seo_description: seoDescription.trim() || null,
        seo_keywords: seoKeywords.trim() || null,
      };
      const res = editing
        ? await fetch(`/api/blog/${post!.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not save"); setBusy(null); return; }
      if (editing) await cleanupReplacedImage(post!.featured_image, featured || null);
      committed.current = true; // saved → keep the inline images
      router.push("/admin/blog");
    } catch { setError("Network error"); setBusy(null); }
  };

  // Live preview mirrors the real blog post page's structure & prose classes.
  const previewTags = tags.split(",").map((t) => t.trim()).filter(Boolean);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3">
        <button onClick={() => router.push("/admin/blog")} className="flex items-center gap-1.5 text-sm text-charcoal-lighter hover:text-charcoal">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-destructive">{error}</span>}
          <AdminButton variant="outline" size="sm" onClick={() => save(false)} disabled={busy !== null}>
            {busy === "draft" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />} Save as Draft
          </AdminButton>
          <AdminButton size="sm" onClick={() => save(true)} disabled={busy !== null}>
            {busy === "publish" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />} Publish
          </AdminButton>
        </div>
      </div>

      {/* Mobile Editor/Preview toggle (side-by-side on lg+) */}
      <div className="mt-3 flex rounded-lg bg-pearl/60 p-0.5 lg:hidden">
        <button
          type="button" onClick={() => setMobilePane("editor")}
          className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all", mobilePane === "editor" ? "bg-card text-charcoal shadow-card" : "text-charcoal-lighter")}
        >
          <Pencil className="h-3.5 w-3.5" /> Editor
        </button>
        <button
          type="button" onClick={() => setMobilePane("preview")}
          className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all", mobilePane === "preview" ? "bg-card text-charcoal shadow-card" : "text-charcoal-lighter")}
        >
          <Eye className="h-3.5 w-3.5" /> Preview
        </button>
      </div>

      {/* Split panes */}
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden pt-3 lg:grid-cols-2">
        {/* ── Editor ── */}
        <div className={cn("overflow-y-auto pr-1 space-y-3", mobilePane === "preview" && "hidden lg:block")}>
          <Input label="Title" value={title} onChange={(e) => onTitle(e.target.value)} placeholder="Post title" />
          <Input label="Slug" value={slug} onChange={(e) => { setSlug(e.target.value); setAutoSlug(false); }} placeholder="post-url-slug" />
          <div>
            <label className="block text-sm font-medium text-charcoal-light mb-1.5">Content</label>
            <BlogEditor value={content} onChange={setContent} placeholder="Write your post…" onImageUploaded={(url) => { sessionImages.current.push(url); }} />
          </div>
          <Textarea label="Excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} placeholder="Short summary shown in listings" />
          <ImageUpload label="Featured image" value={image} onChange={setImage} aspectRatio="video" folder="blog" field="blog_featured_image" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
            <Input label="Reading time (min)" type="number" value={readingTime} onChange={(e) => setReadingTime(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
            <Input label="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>

          {/* Hidden SEO section — collapsed by default; not shown to readers. */}
          <div className="rounded-lg border border-border/40">
            <button type="button" onClick={() => setSeoOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-charcoal">
              {seoOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Search className="h-4 w-4 text-secondary" /> SEO settings
              <span className="ml-auto text-[11px] font-normal text-charcoal-lighter">hidden from readers</span>
            </button>
            {seoOpen && (
              <div className="space-y-3 border-t border-border/30 p-3">
                <Input label="SEO title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={title || "Falls back to the post title"} />
                <Textarea label="SEO description" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} placeholder="120–160 characters" />
                <div>
                  <Input label="SEO keywords" value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} placeholder="korean skincare, k-beauty bangladesh, …" />
                  <p className="mt-1 text-[11px] text-charcoal-lighter">Comma-separated. Added to the page&apos;s meta keywords — not shown on the page.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Live preview ── */}
        <div className={cn("overflow-y-auto rounded-xl border border-border/40 bg-card", mobilePane === "editor" && "hidden lg:block")}>
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/30 bg-card/95 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-charcoal-lighter backdrop-blur">
            <Eye className="h-3.5 w-3.5" /> Live preview
          </div>
          <article className="mx-auto max-w-3xl px-5 py-6">
            {image ? (
              <div className="relative mb-6 aspect-video w-full overflow-hidden rounded-2xl bg-image-surface">
                <Image src={image} alt={title || "Featured"} fill className="object-cover" sizes="768px" unoptimized={image.startsWith("blob:") || image.startsWith("data:") || image.includes("/uploads/")} />
              </div>
            ) : (
              <div className="mb-6 flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-border/50 text-xs text-charcoal-lighter">Featured image</div>
            )}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {category && <span className="rounded-full border border-border/50 px-2 py-0.5 text-[11px] text-charcoal-lighter">{category}</span>}
              <span className="flex items-center gap-1 text-xs text-charcoal-lighter"><Clock className="h-3 w-3" /> {readingTime || 5} min read</span>
              <span className="text-xs text-charcoal-lighter">{formatDateShort(new Date().toISOString())}</span>
            </div>
            <h1 className="mb-4 font-heading text-3xl font-bold leading-tight text-charcoal sm:text-4xl">{title || "Your post title"}</h1>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-charcoal">{(author || "C")[0]}</div>
              <div>
                <p className="text-sm font-medium text-charcoal">{author || "ChineXa Team"}</p>
                <p className="text-xs text-charcoal-lighter">ChineXa Beauty Expert</p>
              </div>
            </div>
            <div className="mb-8 h-px w-full bg-border/40" />
            {content ? (
              <BlogContent html={sanitize(content)} />
            ) : excerpt ? (
              <div className="prose sm:prose-lg max-w-none leading-relaxed text-charcoal-light"><p className="sm:text-lg">{excerpt}</p></div>
            ) : (
              <p className="text-sm italic text-charcoal-lighter">Start writing — your formatted post appears here in real time.</p>
            )}
            {previewTags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2 border-t border-border/30 pt-6">
                {previewTags.map((t) => <span key={t} className={cn("rounded-full bg-pearl px-3 py-1 text-xs text-charcoal-lighter")}>#{t}</span>)}
              </div>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
