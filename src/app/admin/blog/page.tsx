"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Plus, Edit, Trash2, MoreHorizontal, Eye, Calendar, Clock, Loader2, AlertTriangle, FileText } from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/admin/shared/image-upload";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateShort, slugify } from "@/lib/utils";
import type { BlogPost } from "@/types/blog";
import { useAdmin } from "@/contexts/admin-context";

export default function AdminBlogPage() {
  const { can } = useAdmin();
  const canAddBlog = can("blog", "add");
  const canEditBlog = can("blog", "edit");
  const canDeleteBlog = can("blog", "delete");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPost, setEditPost] = useState<BlogPost | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<BlogPost | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formExcerpt, setFormExcerpt] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formAuthor, setFormAuthor] = useState("ChineXa Team");
  const [formReadingTime, setFormReadingTime] = useState("5");
  const [formPublished, setFormPublished] = useState(false);
  const [autoSlug, setAutoSlug] = useState(true);

  const fetchPosts = async () => {
    try {
      const res = await fetch("/api/blog?all=1&limit=200");
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchPosts(); }, []);

  const resetForm = () => {
    setFormTitle(""); setFormSlug(""); setFormExcerpt(""); setFormContent("");
    setFormImage(""); setFormCategory(""); setFormTags(""); setFormAuthor("ChineXa Team");
    setFormReadingTime("5"); setFormPublished(false); setAutoSlug(true); setEditPost(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (post: BlogPost) => {
    setEditPost(post);
    setFormTitle(post.title);
    setFormSlug(post.slug);
    setFormExcerpt(post.excerpt || "");
    setFormContent(post.content || "");
    setFormImage(post.featured_image || "");
    setFormCategory(post.category || "");
    setFormTags((post.tags || []).join(", "));
    setFormAuthor(post.author_name || "ChineXa Team");
    setFormReadingTime(String(post.reading_time || 5));
    setFormPublished(post.is_published);
    setAutoSlug(false);
    setDialogOpen(true);
  };

  const handleTitleChange = (val: string) => {
    setFormTitle(val);
    if (autoSlug) setFormSlug(slugify(val));
  };

  const handleSave = async () => {
    if (!formTitle.trim()) return;
    setSaving(true);
    try {
      const tags = formTags.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        title: formTitle.trim(),
        slug: formSlug.trim() || slugify(formTitle),
        excerpt: formExcerpt.trim() || null,
        content: formContent.trim() || null,
        featured_image: formImage || null,
        category: formCategory.trim() || null,
        tags,
        author_name: formAuthor.trim() || "ChineXa Team",
        reading_time: Number(formReadingTime) || 5,
        is_published: formPublished,
      };
      if (editPost) {
        await fetch(`/api/blog/${editPost.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await fetch("/api/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      setDialogOpen(false);
      resetForm();
      fetchPosts();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    await fetch(`/api/blog/${deleteDialog.id}`, { method: "DELETE" }).catch(() => {});
    setPosts((prev) => prev.filter((p) => p.id !== deleteDialog.id));
    setDeleteDialog(null);
  };

  const handleTogglePublish = async (post: BlogPost) => {
    const newPublished = !post.is_published;
    await fetch(`/api/blog/${post.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_published: newPublished }) }).catch(() => {});
    setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, is_published: newPublished } : p));
  };

  const publishedCount = posts.filter((p) => p.is_published).length;
  const draftCount = posts.filter((p) => !p.is_published).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Blog</h1>
          <p className="text-sm text-charcoal-lighter">{posts.length} post{posts.length !== 1 ? "s" : ""} · {publishedCount} published · {draftCount} draft{draftCount !== 1 ? "s" : ""}</p>
        </div>
        {canAddBlog && <AdminButton onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Post</AdminButton>}
      </div>

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>)}</div>
      ) : posts.length === 0 ? (
        <EmptyState icon={FileText} title="No blog posts yet" description="Write your first blog post." actionLabel={canAddBlog ? "New Post" : undefined} onAction={canAddBlog ? openCreate : undefined} />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className={!post.is_published ? "opacity-60" : ""}>
              <CardContent className="p-0">
                <div className="flex gap-4 p-4">
                  {post.featured_image && (
                    <div className="relative h-24 w-36 flex-shrink-0 rounded-xl overflow-hidden bg-pearl hidden sm:block">
                      <Image src={post.featured_image} alt={post.title} fill className="object-cover" sizes="144px" unoptimized={post.featured_image.startsWith("/uploads/")} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium text-charcoal mb-1 line-clamp-1">{post.title}</h3>
                        {post.excerpt && <p className="text-xs text-charcoal-lighter line-clamp-2 mb-2">{post.excerpt}</p>}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-1.5 hover:bg-pearl rounded-lg flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4 text-charcoal-lighter" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => window.open(`/blog/${post.slug}`, "_blank")}><Eye className="h-3.5 w-3.5 mr-2" /> Preview</DropdownMenuItem>
                          {canEditBlog && <DropdownMenuItem onClick={() => openEdit(post)}><Edit className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>}
                          {(canEditBlog || canDeleteBlog) && <DropdownMenuSeparator />}
                          {canDeleteBlog && <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(post)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-charcoal-lighter">
                      <Badge variant={post.is_published ? "success" : "warning"} className="text-[10px]">{post.is_published ? "Published" : "Draft"}</Badge>
                      {post.published_at && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateShort(post.published_at)}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {post.reading_time} min</span>
                      <span>{(post.views || 0).toLocaleString()} views</span>
                      {post.category && <Badge variant="outline" className="text-[10px]">{post.category}</Badge>}
                      <Switch checked={post.is_published} onCheckedChange={() => handleTogglePublish(post)} disabled={!canEditBlog} />
                    </div>
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {post.tags.map((tag) => <span key={tag} className="text-[10px] bg-pearl px-1.5 py-0.5 rounded-md text-charcoal-lighter">#{tag}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editPost ? "Edit Post" : "Create Blog Post"}</DialogTitle>
            <DialogDescription>{editPost ? "Update blog post" : "Write and publish a new blog post"}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 py-2 pr-1">
            <Input label="Title *" placeholder="The Ultimate Guide to..." value={formTitle} onChange={(e) => handleTitleChange(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Slug</label>
              <div className="flex items-center rounded-xl border border-border overflow-hidden focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20">
                <span className="px-2.5 text-[11px] text-charcoal-lighter bg-pearl border-r border-border h-11 flex items-center shrink-0">/blog/</span>
                <input className="flex-1 h-11 px-3 text-sm text-charcoal outline-none" value={formSlug} onChange={(e) => { setFormSlug(e.target.value); setAutoSlug(false); }} placeholder="post-slug" />
              </div>
            </div>
            <Textarea label="Excerpt" placeholder="Brief summary for listing pages..." value={formExcerpt} onChange={(e) => setFormExcerpt(e.target.value)} className="min-h-[60px]" />
            <Textarea label="Content" placeholder="Write your blog post content here..." value={formContent} onChange={(e) => setFormContent(e.target.value)} className="min-h-[200px]" />
            <ImageUpload label="Featured Image" value={formImage} onChange={setFormImage} aspectRatio="video" placeholder="Upload featured image (1200x675 recommended)" folder="blog" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Category" placeholder="Skincare, Fashion, Beauty" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} />
              <Input label="Tags (comma separated)" placeholder="skincare, guide, tips" value={formTags} onChange={(e) => setFormTags(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="Author" placeholder="ChineXa Team" value={formAuthor} onChange={(e) => setFormAuthor(e.target.value)} />
              <Input label="Reading Time (min)" type="number" value={formReadingTime} onChange={(e) => setFormReadingTime(e.target.value)} />
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch checked={formPublished} onCheckedChange={setFormPublished} />
                  <span className="text-sm font-medium text-charcoal-light">{formPublished ? "Publish" : "Draft"}</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <AdminButton variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</AdminButton>
            <AdminButton onClick={handleSave} disabled={saving || !formTitle.trim()}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {editPost ? "Save Changes" : formPublished ? "Publish" : "Save Draft"}
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete Post</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {deleteDialog && <p className="text-sm text-charcoal-light"><strong>{deleteDialog.title}</strong> — {(deleteDialog.views || 0).toLocaleString()} views</p>}
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /> Delete</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
