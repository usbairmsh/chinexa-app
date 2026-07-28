"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, Eye, ArrowLeft, Share2, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useBlogPost } from "@/hooks/queries/use-blog";
import { formatDateShort } from "@/lib/utils";
import { BlogContent } from "@/components/storefront/blog/blog-content";

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = useBlogPost(slug);
  const [shared, setShared] = useState(false);

  // Count a view once per browser session per post (a refresh won't re-count).
  useEffect(() => {
    if (!slug) return;
    const key = `blog-viewed-${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* private mode — still count, just may re-count */ }
    fetch(`/api/blog/${encodeURIComponent(slug)}/view`, { method: "POST" }).catch(() => {});
  }, [slug]);

  // Native share sheet where available (mobile), clipboard-copy fallback
  // otherwise (desktop) with a brief "Copied!" confirmation.
  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = post?.title || "ChineXa Blog";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text: post?.excerpt || title, url });
        return;
      }
    } catch {
      // User dismissed the share sheet, or it failed — fall through to copy.
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* clipboard blocked — nothing else we can do */ }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="h-5 w-48 mb-6" />
        <Skeleton className="aspect-[16/9] rounded-2xl mb-8" />
        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="font-heading text-2xl font-semibold text-charcoal mb-2">Post Not Found</h1>
        <Link href="/blog"><Button variant="primary">Back to Blog</Button></Link>
      </div>
    );
  }

  return (
    <div className="bg-card min-h-screen">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb items={[{ label: "Blog", href: "/blog" }, { label: post.title }]} className="mb-6" />

        <Link href="/blog" className="group inline-flex items-center gap-1 text-sm text-charcoal-lighter hover:text-secondary transition-colors mb-6">
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" /> Back to Blog
        </Link>

        <motion.article
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {/* Featured Image */}
          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-image-surface mb-8 shadow-card">
            <Image
              src={post.featured_image}
              alt={post.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge variant="outline">{post.category}</Badge>
            <span className="text-xs text-charcoal-lighter flex items-center gap-1">
              <Clock className="h-3 w-3" /> {post.reading_time} min read
            </span>
            <span className="text-xs text-charcoal-lighter flex items-center gap-1">
              <Eye className="h-3 w-3" /> {post.views.toLocaleString()} views
            </span>
            <span className="text-xs text-charcoal-lighter">
              {post.published_at ? formatDateShort(post.published_at) : ""}
            </span>
          </div>

          {/* Title */}
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-4 leading-tight">
            {post.title}
          </h1>

          {/* Author */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-sm font-medium text-charcoal">
              {post.author_name[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-charcoal">{post.author_name}</p>
              <p className="text-xs text-charcoal-lighter">ChineXa Beauty Expert</p>
            </div>
          </div>

          <Separator className="mb-8" />

          {/* Content */}
          {post.content ? (
            <BlogContent html={post.content} />
          ) : post.excerpt ? (
            <div className="prose sm:prose-lg max-w-none text-charcoal-light leading-relaxed">
              <p className="sm:text-lg">{post.excerpt}</p>
            </div>
          ) : null}

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border/30">
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-pearl px-3 py-1 rounded-full text-charcoal-lighter">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Share */}
          <div className="mt-6 flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleShare}>
              {shared ? <><Check className="h-3.5 w-3.5 mr-1 text-success" /> Link copied</> : <><Share2 className="h-3.5 w-3.5 mr-1" /> Share</>}
            </Button>
          </div>
        </motion.article>
      </div>
    </div>
  );
}
