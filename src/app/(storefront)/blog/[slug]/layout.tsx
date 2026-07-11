import type { Metadata } from "next";
import pool from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getBlogPostBySlug } from "@/lib/blog";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT title, excerpt, featured_image, author_name, published_at, updated_at FROM blog_posts WHERE slug = ? AND is_published = 1 LIMIT 1",
      [slug]
    );
    if (rows.length === 0) {
      return { title: "Post Not Found", robots: { index: false, follow: true } };
    }
    const post = rows[0];
    const title = post.title as string;
    const description = ((post.excerpt as string) || "").slice(0, 160) || `Read "${title}" on the ChineXa beauty blog.`;
    const image = (post.featured_image as string) || `${siteUrl}/logo.png`;
    const fullImage = image.startsWith("http") ? image : `${siteUrl}${image}`;

    return {
      title,
      description,
      alternates: { canonical: `${siteUrl}/blog/${slug}` },
      openGraph: {
        title,
        description,
        url: `${siteUrl}/blog/${slug}`,
        type: "article",
        publishedTime: post.published_at ? new Date(post.published_at as string).toISOString() : undefined,
        modifiedTime: post.updated_at ? new Date(post.updated_at as string).toISOString() : undefined,
        authors: post.author_name ? [post.author_name as string] : undefined,
        images: [{ url: fullImage, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [fullImage],
      },
    };
  } catch {
    return { title: "Blog Post" };
  }
}

export default async function BlogPostLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Server-side prefetch — same pattern as the product detail and category
  // pages: the page below is a client component reading this same query key
  // via useBlogPost(). Without this, the article body is entirely absent
  // from the initial server-rendered HTML.
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["blog", slug],
    queryFn: () => getBlogPostBySlug(slug),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
