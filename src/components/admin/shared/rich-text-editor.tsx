"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Quote, Link2, Package, Code, Heading2, Heading3, Pilcrow, RemoveFormatting, Loader2, Search } from "lucide-react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import type { Product } from "@/types/product";

// Zero-dependency rich text editor for blog content. Produces plain HTML into
// the same string state the old <Textarea> used, so existing posts load and
// save unchanged — this only upgrades the editing experience (headings, lists,
// links and one-click PRODUCT links for internal linking). A source toggle
// exposes the raw HTML for full manual control.
//
// Built on contentEditable + document.execCommand: deprecated on paper but
// universally supported, and avoids adding a rich-text dependency that could
// fight the React/Next versions.

interface RichTextEditorProps {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ label, value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [productLoading, setProductLoading] = useState(false);

  // Sync external value → editable. Only when the editor isn't focused (i.e. on
  // mount, dialog reopen, or returning from source mode) so typing never gets
  // clobbered and the caret never jumps.
  useEffect(() => {
    const el = editorRef.current;
    if (el && !sourceMode && document.activeElement !== el && el.innerHTML !== (value || "")) {
      el.innerHTML = value || "";
    }
  }, [value, sourceMode]);

  const emit = () => {
    const el = editorRef.current;
    if (el) onChange(el.innerHTML === "<br>" ? "" : el.innerHTML);
  };

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  // Save the caret/selection before a dialog steals focus, restore it before
  // inserting, so links land exactly where the author was writing.
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    } else {
      savedRange.current = null;
    }
  };
  const restoreSelection = () => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const insertLink = (href: string, fallbackText: string) => {
    restoreSelection();
    const selectedText = savedRange.current && !savedRange.current.collapsed ? savedRange.current.toString() : "";
    const text = selectedText || fallbackText;
    const a = `<a href="${href.replace(/"/g, "&quot;")}">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</a>`;
    document.execCommand("insertHTML", false, a);
    emit();
  };

  // Product picker — debounced search against the existing products API.
  useEffect(() => {
    if (!productOpen) return;
    const q = productQuery.trim();
    const t = setTimeout(async () => {
      setProductLoading(true);
      try {
        const sp = new URLSearchParams({ page_size: "8" });
        if (q) sp.set("search", q);
        const res = await fetch(`/api/products?${sp.toString()}`);
        const data = await res.json();
        setProductResults(Array.isArray(data?.data) ? data.data : []);
      } catch { setProductResults([]); } finally { setProductLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [productOpen, productQuery]);

  const toolbarBtn = "flex h-8 w-8 items-center justify-center rounded-lg text-charcoal-lighter hover:text-charcoal hover:bg-pearl transition-colors active:scale-[0.94]";

  return (
    <div>
      {label && <label className="block text-sm font-medium text-charcoal-light mb-1.5">{label}</label>}
      <div className="rounded-lg border border-border overflow-hidden focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border/40 bg-pearl/40">
          <button type="button" title="Heading" className={toolbarBtn} onClick={() => exec("formatBlock", "h2")}><Heading2 className="h-4 w-4" /></button>
          <button type="button" title="Subheading" className={toolbarBtn} onClick={() => exec("formatBlock", "h3")}><Heading3 className="h-4 w-4" /></button>
          <button type="button" title="Paragraph" className={toolbarBtn} onClick={() => exec("formatBlock", "p")}><Pilcrow className="h-4 w-4" /></button>
          <span className="w-px h-5 bg-border/60 mx-1" />
          <button type="button" title="Bold" className={toolbarBtn} onClick={() => exec("bold")}><Bold className="h-4 w-4" /></button>
          <button type="button" title="Italic" className={toolbarBtn} onClick={() => exec("italic")}><Italic className="h-4 w-4" /></button>
          <span className="w-px h-5 bg-border/60 mx-1" />
          <button type="button" title="Bullet list" className={toolbarBtn} onClick={() => exec("insertUnorderedList")}><List className="h-4 w-4" /></button>
          <button type="button" title="Numbered list" className={toolbarBtn} onClick={() => exec("insertOrderedList")}><ListOrdered className="h-4 w-4" /></button>
          <button type="button" title="Quote" className={toolbarBtn} onClick={() => exec("formatBlock", "blockquote")}><Quote className="h-4 w-4" /></button>
          <span className="w-px h-5 bg-border/60 mx-1" />
          <button type="button" title="Insert link" className={toolbarBtn} onClick={() => { saveSelection(); setLinkUrl(""); setLinkOpen(true); }}><Link2 className="h-4 w-4" /></button>
          <button type="button" title="Link a product (internal link)" className={cn(toolbarBtn, "text-secondary hover:text-secondary")} onClick={() => { saveSelection(); setProductQuery(""); setProductOpen(true); }}><Package className="h-4 w-4" /></button>
          <span className="w-px h-5 bg-border/60 mx-1" />
          <button type="button" title="Clear formatting" className={toolbarBtn} onClick={() => exec("removeFormat")}><RemoveFormatting className="h-4 w-4" /></button>
          <button type="button" title={sourceMode ? "Back to visual editor" : "Edit HTML source"} className={cn(toolbarBtn, "ml-auto", sourceMode && "bg-charcoal !text-white hover:bg-charcoal")} onClick={() => { if (!sourceMode) emit(); setSourceMode(!sourceMode); }}><Code className="h-4 w-4" /></button>
        </div>

        {/* Editing surface */}
        {sourceMode ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full min-h-[240px] p-3 text-xs font-mono text-charcoal outline-none resize-y"
            placeholder="<p>HTML source…</p>"
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={emit}
            onBlur={emit}
            data-placeholder={placeholder || "Write your content…"}
            className="rte-editable prose max-w-none min-h-[240px] p-3 text-sm text-charcoal outline-none"
          />
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-charcoal-lighter">
        Tip: select text, then use <Package className="inline h-3 w-3 text-secondary" /> to link it to a product — internal links help both readers and Google.
      </p>

      {/* Plain link dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>Insert link</DialogTitle>
            <DialogDescription>Selected text becomes the link; without a selection, the URL is inserted as text.</DialogDescription>
          </DialogHeader>
          <Input label="URL" placeholder="https://… or /categories/skincare" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && linkUrl.trim()) { setLinkOpen(false); insertLink(linkUrl.trim(), linkUrl.trim()); } }} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button variant="secondary" className="!text-white" disabled={!linkUrl.trim()} onClick={() => { setLinkOpen(false); insertLink(linkUrl.trim(), linkUrl.trim()); }}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product link picker */}
      <Dialog open={productOpen} onOpenChange={setProductOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Link a product</DialogTitle>
            <DialogDescription>Inserts a link to the product page — selected text becomes the link, otherwise the product name is inserted.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Search products…" icon={<Search className="h-4 w-4" />} value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {productLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-charcoal-lighter" /></div>
            ) : productResults.length === 0 ? (
              <p className="text-xs text-charcoal-lighter text-center py-6">No products found.</p>
            ) : (
              productResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setProductOpen(false); insertLink(`/products/${p.slug}`, p.name); }}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-pearl transition-colors"
                >
                  <div className="relative h-9 w-9 shrink-0 rounded-lg overflow-hidden bg-pearl">
                    <Image src={p.images?.[0]?.url || `https://picsum.photos/seed/${p.slug}/72/72`} alt={p.name} fill className="object-cover" sizes="36px" unoptimized={p.images?.[0]?.url?.includes("/uploads/")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-charcoal truncate">{p.name}</p>
                    <p className="text-[10px] text-charcoal-lighter">{formatCurrency(p.price)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
