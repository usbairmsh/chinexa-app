import { type RowDataPacket } from "mysql2/promise";
import pool from "@/lib/db";
import { markdownResponse, htmlToMarkdown, withMarkdownErrorHandling } from "@/lib/markdown-response";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return withMarkdownErrorHandling(async () => {
  const { slug } = await params;

  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT title, excerpt, content, author_name, published_at, category FROM blog_posts WHERE slug = ? AND is_published = 1 LIMIT 1",
    [slug]
  );

  if (rows.length === 0) {
    return markdownResponse(`# Not Found\n\nNo blog post found at this URL.\n`, { status: 404 });
  }

  const post = rows[0];
  const publishedDate = post.published_at ? new Date(post.published_at as string).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;

  const lines: string[] = [];
  lines.push(`# ${post.title}`);
  lines.push("");
  const meta = [
    post.author_name ? `By ${post.author_name}` : null,
    publishedDate,
    post.category ? `Category: ${post.category}` : null,
  ].filter(Boolean);
  if (meta.length > 0) { lines.push(`*${meta.join(" — ")}*`); lines.push(""); }

  if (post.excerpt) { lines.push(`> ${post.excerpt}`); lines.push(""); }

  if (post.content) {
    lines.push(htmlToMarkdown(post.content as string));
    lines.push("");
  }

  lines.push(`[Read on site](${siteUrl}/blog/${slug})`);

  return markdownResponse(lines.join("\n"));
  });
}
