"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BlogEditorScreen } from "@/components/admin/blog/blog-editor-screen";
import type { BlogPost } from "@/types/blog";

export default function EditBlogPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    // The list endpoint returns full rows; find this post by id.
    fetch("/api/blog?all=1&limit=200")
      .then((r) => r.json())
      .then((rows: BlogPost[]) => {
        const found = Array.isArray(rows) ? rows.find((p) => p.id === id) : null;
        if (found) { setPost(found); setState("ready"); }
        else setState("error");
      })
      .catch(() => setState("error"));
  }, [id]);

  if (state === "loading") {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-charcoal-lighter" /></div>;
  }
  if (state === "error" || !post) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-charcoal-lighter">Post not found.</p>
        <button onClick={() => router.push("/admin/blog")} className="text-sm text-secondary hover:underline">Back to blog</button>
      </div>
    );
  }
  return <BlogEditorScreen post={post} />;
}
