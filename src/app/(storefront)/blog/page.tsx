"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecentPosts } from "@/hooks/queries/use-blog";
import { formatDateShort } from "@/lib/utils";

export default function BlogPage() {
  const { data: posts, isLoading } = useRecentPosts(20);

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-hero-gradient py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={[{ label: "Blog" }]} />
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-semibold text-charcoal mt-4">
            Beauty Journal
          </h1>
          <p className="text-charcoal-lighter mt-3 max-w-lg">
            Tips, guides, and stories from the world of beauty and luxury lifestyle.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[16/9] rounded-2xl" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts?.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/blog/${post.slug}`} className="group block">
                  <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-pearl mb-4">
                    <Image
                      src={post.featured_image}
                      alt={post.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px]">{post.category}</Badge>
                    <span className="text-[10px] text-charcoal-lighter flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {post.reading_time} min
                    </span>
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-charcoal group-hover:text-secondary transition-colors mb-1 line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-sm text-charcoal-lighter line-clamp-2 mb-2">{post.excerpt}</p>
                  <div className="flex items-center gap-3 text-[10px] text-charcoal-lighter">
                    <span>{post.published_at ? formatDateShort(post.published_at) : ""}</span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {post.views}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
