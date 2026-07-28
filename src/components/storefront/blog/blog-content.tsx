"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { ProductCard } from "@/components/storefront/product/product-card";
import { Loader2 } from "lucide-react";
import type { Product } from "@/types/product";

// Renders blog post HTML, replacing product-card tokens with live product
// cards. A token looks like:
//   <div data-product-cards="id1,id2,id3" data-cols="3"></div>
// The content is split on these tokens: plain HTML segments render via
// dangerouslySetInnerHTML, and each token renders a real ProductCard grid
// (max 3 per row) fetched by id.

interface Block {
  type: "html" | "cards";
  html?: string;
  ids?: string[];
  cols?: number;
}

const TOKEN_RE = /<div[^>]*data-product-cards=["']([^"']*)["'][^>]*>[\s\S]*?<\/div>/gi;

function parseCols(tag: string): number {
  const m = tag.match(/data-cols=["'](\d)["']/);
  const n = m ? Number(m[1]) : 3;
  return n === 2 ? 2 : 3; // only 2 or 3 supported; default 3
}

function splitContent(html: string): Block[] {
  const blocks: Block[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(html)) !== null) {
    if (match.index > last) blocks.push({ type: "html", html: html.slice(last, match.index) });
    const ids = match[1].split(",").map((s) => s.trim()).filter(Boolean);
    blocks.push({ type: "cards", ids, cols: parseCols(match[0]) });
    last = match.index + match[0].length;
  }
  if (last < html.length) blocks.push({ type: "html", html: html.slice(last) });
  return blocks;
}

const GRID = { 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3" } as const;

function CardGrid({ ids, cols }: { ids: string[]; cols: number }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  useEffect(() => {
    if (ids.length === 0) { setProducts([]); return; }
    let alive = true;
    fetch(`/api/products?ids=${encodeURIComponent(ids.join(","))}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setProducts(Array.isArray(d?.data) ? d.data : []); })
      .catch(() => { if (alive) setProducts([]); });
    return () => { alive = false; };
  }, [ids]);

  if (products === null) {
    return <div className="my-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-charcoal-lighter" /></div>;
  }
  if (products.length === 0) return null;
  // Preserve the author's chosen order.
  const ordered = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[];
  return (
    <div className={`not-prose my-8 grid gap-4 lg:gap-6 ${GRID[cols === 2 ? 2 : 3]}`}>
      {ordered.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
    </div>
  );
}

export function BlogContent({ html }: { html: string }) {
  const blocks = useMemo(() => splitContent(html || ""), [html]);
  return (
    <div className="prose sm:prose-lg max-w-none leading-relaxed text-charcoal-light prose-headings:font-heading prose-headings:text-charcoal prose-a:text-secondary [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse [&_td]:border [&_th]:border [&_td]:border-border/50 [&_th]:border-border/50 [&_td]:p-2 [&_th]:p-2 [&_td]:align-top [&_th]:text-left">
      {blocks.map((b, i) =>
        b.type === "html"
          ? <div key={i} dangerouslySetInnerHTML={{ __html: b.html || "" }} />
          : <CardGrid key={i} ids={b.ids || []} cols={b.cols || 3} />
      )}
    </div>
  );
}
