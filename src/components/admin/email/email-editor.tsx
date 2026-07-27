"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3, Pilcrow,
  List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight, Link2, Link2Off,
  Minus, RemoveFormatting, Undo2, Redo2, Code, Baseline, ImagePlus, Loader2, UploadCloud,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { cn } from "@/lib/utils";

// Inline images in email must be ABSOLUTE public URLs. Uploads return an
// app-relative path; prefix it with the site origin so inboxes can load them.
function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Purpose-built rich text editor for composing email (replies, broadcasts,
// promos). Robust for use inside modals:
//   • content is UNCONTROLLED — innerHTML is set once on mount and only re-seeded
//     when `resetKey` changes (parent bumps it to clear/reload). This removes the
//     caret-jumping and lost-keystrokes bugs of value-synced contentEditable.
//   • links use absolute URLs (relative internal links don't work in inboxes).

const PALETTE = ["#2f3b3a", "#BC4A72", "#C79A42", "#159A8C", "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#0f172a", "#6b7280"];

export function EmailEditor({ value, onChange, resetKey = 0, placeholder, minHeight = 220, composeToken }: {
  value: string;
  onChange: (html: string) => void;
  /** Bump to force the editor to re-seed from `value` (e.g. clear after send). */
  resetKey?: number;
  placeholder?: string;
  minHeight?: number;
  /** Compose-session token: inline images are staged under it so an abandoned
   *  compose can be cleaned up. Falls back to the generic /api/upload if absent. */
  composeToken?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
  const [lastColor, setLastColor] = useState("#BC4A72");
  // Image insertion (upload or by URL).
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageWidth, setImageWidth] = useState<"full" | "half" | "auto">("full");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  // Track active formatting so toolbar buttons can highlight.
  const [, force] = useState(0);
  const refresh = useCallback(() => force((n) => n + 1), []);

  // Seed content on mount and whenever resetKey changes — NOT on every value
  // change (that would fight the user's caret).
  useEffect(() => {
    const el = ref.current;
    if (el && !sourceMode) el.innerHTML = value || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML;
    onChange(html === "<br>" || html === "<div><br></div>" ? "" : html);
  };

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    try { document.execCommand("styleWithCSS", false, "true"); } catch { /* older browsers */ }
    document.execCommand(command, false, arg);
    emit();
    refresh();
  };

  const isActive = (cmd: string) => {
    try { return document.queryCommandState(cmd); } catch { return false; }
  };

  // The current block element's tag (h1/h2/h3/p/blockquote/div…), normalized.
  const currentBlock = (): string => {
    try {
      const v = String(document.queryCommandValue("formatBlock") || "").toLowerCase();
      return v.replace(/[<>]/g, "");
    } catch { return ""; }
  };
  const blockActive = (tag: string) => currentBlock() === tag;

  // Toggle a block format: apply the tag, or revert to a paragraph if the
  // selection is already that tag. This is what lets Quote / headings turn OFF.
  const toggleBlock = (tag: string) => {
    ref.current?.focus();
    const next = currentBlock() === tag ? "p" : tag;
    document.execCommand("formatBlock", false, next);
    emit();
    refresh();
  };

  // Pressing Enter inside a blockquote should let you leave it: an Enter on an
  // empty line at the end of the quote breaks out to a normal paragraph.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey && currentBlock() === "blockquote") {
      const sel = window.getSelection();
      const line = sel?.anchorNode?.textContent ?? "";
      // Empty current line → exit the quote instead of adding another quoted line.
      if (line.trim() === "") {
        e.preventDefault();
        document.execCommand("formatBlock", false, "p");
        emit();
        refresh();
      }
    }
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    savedRange.current = sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)
      ? sel.getRangeAt(0).cloneRange() : null;
  };
  const restoreSelection = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (sel && savedRange.current) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
  };

  const openLink = () => {
    saveSelection();
    const selected = savedRange.current && !savedRange.current.collapsed ? savedRange.current.toString() : "";
    setLinkText(selected);
    setLinkUrl("https://");
    setLinkOpen(true);
  };
  const insertLink = () => {
    let href = linkUrl.trim();
    if (!href) return;
    // Email links must be absolute; nudge bare domains to https.
    if (!/^(https?:|mailto:|tel:)/i.test(href)) href = `https://${href.replace(/^\/+/, "")}`;
    restoreSelection();
    const hadSelection = savedRange.current && !savedRange.current.collapsed;
    if (hadSelection) {
      document.execCommand("createLink", false, href);
    } else {
      const text = (linkText.trim() || href).replace(/</g, "&lt;").replace(/>/g, "&gt;");
      document.execCommand("insertHTML", false, `<a href="${href.replace(/"/g, "&quot;")}">${text}</a>`);
    }
    setLinkOpen(false);
    emit(); refresh();
  };

  const applyColor = (color: string) => {
    setColorOpen(false);
    setLastColor(color);
    restoreSelection();
    exec("foreColor", color);
  };

  const openImage = () => {
    saveSelection();
    setImageUrl(""); setImageAlt(""); setImageWidth("full"); setImageError("");
    setImageOpen(true);
  };

  const uploadImageFile = async (file: File) => {
    setImageUploading(true); setImageError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (composeToken) {
        // Stage under the compose token so an abandoned compose is cleaned up.
        fd.append("compose_token", composeToken);
        fd.append("inline", "1");
        const res = await fetch("/api/admin-email/attachments", { method: "POST", body: fd });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { setImageError(d.error || "Upload failed"); return; }
        setImageUrl(absoluteUrl(d.attachment.url));
      } else {
        fd.append("folder", "email");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { setImageError(d.error || "Upload failed"); return; }
        setImageUrl(absoluteUrl(d.url));
      }
    } catch { setImageError("Upload failed"); }
    finally { setImageUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const insertImage = () => {
    const src = absoluteUrl(imageUrl.trim());
    if (!src) return;
    const widthStyle = imageWidth === "full" ? "width:100%;max-width:100%;"
      : imageWidth === "half" ? "width:50%;max-width:50%;"
      : "max-width:100%;";
    const img = `<img src="${src.replace(/"/g, "&quot;")}" alt="${imageAlt.replace(/"/g, "&quot;")}" style="${widthStyle}height:auto;display:block;border:0;outline:none;" />`;
    restoreSelection();
    document.execCommand("insertHTML", false, img);
    setImageOpen(false);
    emit(); refresh();
  };

  const btn = "flex h-8 w-8 items-center justify-center rounded-md text-charcoal-lighter transition-colors hover:bg-pearl hover:text-charcoal active:scale-[0.94]";
  // Selected/active tool: dark background, white icon — clearly reads as "on".
  const activeCls = "!bg-charcoal !text-white hover:!bg-charcoal";
  const sep = <span className="mx-0.5 h-5 w-px bg-border/50" />;

  return (
    <div className="rounded-lg border border-border overflow-hidden focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/40 bg-pearl/40 px-2 py-1.5">
        <button type="button" title="Undo" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("undo")}><Undo2 className="h-4 w-4" /></button>
        <button type="button" title="Redo" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("redo")}><Redo2 className="h-4 w-4" /></button>
        {sep}
        <button type="button" title="Heading 1" className={cn(btn, blockActive("h1") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={() => toggleBlock("h1")}><Heading1 className="h-4 w-4" /></button>
        <button type="button" title="Heading 2" className={cn(btn, blockActive("h2") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={() => toggleBlock("h2")}><Heading2 className="h-4 w-4" /></button>
        <button type="button" title="Heading 3" className={cn(btn, blockActive("h3") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={() => toggleBlock("h3")}><Heading3 className="h-4 w-4" /></button>
        <button type="button" title="Paragraph" className={cn(btn, (blockActive("p") || blockActive("div") || currentBlock() === "") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "p")}><Pilcrow className="h-4 w-4" /></button>
        {sep}
        <button type="button" title="Bold" className={cn(btn, isActive("bold") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}><Bold className="h-4 w-4" /></button>
        <button type="button" title="Italic" className={cn(btn, isActive("italic") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}><Italic className="h-4 w-4" /></button>
        <button type="button" title="Underline" className={cn(btn, isActive("underline") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}><Underline className="h-4 w-4" /></button>
        <button type="button" title="Strikethrough" className={cn(btn, isActive("strikeThrough") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("strikeThrough")}><Strikethrough className="h-4 w-4" /></button>
        {/* Text color */}
        <div className="relative">
          <button
            type="button" title="Text color"
            className={cn(btn, "flex-col !gap-0", colorOpen && activeCls)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { saveSelection(); setColorOpen((v) => !v); }}
          >
            <Baseline className="h-4 w-3.5" />
            <span className="h-[3px] w-4 rounded-full" style={{ background: lastColor }} />
          </button>
          {colorOpen && (
            <div className="absolute left-0 top-9 z-50 w-44 rounded-lg border border-border/50 bg-card p-2 shadow-luxury-hover">
              <p className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal-lighter">Text color</p>
              <div className="grid grid-cols-6 gap-1">
                {PALETTE.map((c) => (
                  <button key={c} type="button" className="h-5 w-5 rounded-full border border-border/40 transition-transform hover:scale-110" style={{ background: c }} onMouseDown={(e) => e.preventDefault()} onClick={() => applyColor(c)} title={c} />
                ))}
              </div>
              {/* Custom color picker for any color */}
              <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[11px] text-charcoal-lighter hover:bg-pearl" onMouseDown={(e) => e.preventDefault()}>
                <span className="inline-block h-4 w-4 rounded-full border border-border/40" style={{ background: lastColor }} />
                Custom…
                <input type="color" value={lastColor} className="ml-auto h-5 w-6 cursor-pointer border-0 bg-transparent p-0" onChange={(e) => applyColor(e.target.value)} />
              </label>
              <button type="button" className="mt-1 w-full rounded-md px-1 py-1 text-left text-[11px] text-charcoal-lighter hover:bg-pearl" onMouseDown={(e) => e.preventDefault()} onClick={() => applyColor("#2f3b3a")}>Reset to default</button>
            </div>
          )}
        </div>
        {sep}
        <button type="button" title="Bullet list" className={cn(btn, isActive("insertUnorderedList") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}><List className="h-4 w-4" /></button>
        <button type="button" title="Numbered list" className={cn(btn, isActive("insertOrderedList") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}><ListOrdered className="h-4 w-4" /></button>
        <button type="button" title="Quote (click again to remove)" className={cn(btn, blockActive("blockquote") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={() => toggleBlock("blockquote")}><Quote className="h-4 w-4" /></button>
        {sep}
        <button type="button" title="Align left" className={cn(btn, isActive("justifyLeft") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyLeft")}><AlignLeft className="h-4 w-4" /></button>
        <button type="button" title="Align center" className={cn(btn, isActive("justifyCenter") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyCenter")}><AlignCenter className="h-4 w-4" /></button>
        <button type="button" title="Align right" className={cn(btn, isActive("justifyRight") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyRight")}><AlignRight className="h-4 w-4" /></button>
        {sep}
        <button type="button" title="Insert link" className={cn(btn, isActive("createLink") && activeCls)} onMouseDown={(e) => e.preventDefault()} onClick={openLink}><Link2 className="h-4 w-4" /></button>
        <button type="button" title="Remove link" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("unlink")}><Link2Off className="h-4 w-4" /></button>
        <button type="button" title="Insert image / GIF" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={openImage}><ImagePlus className="h-4 w-4" /></button>
        <button type="button" title="Horizontal line" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertHorizontalRule")}><Minus className="h-4 w-4" /></button>
        <button type="button" title="Clear formatting" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("removeFormat")}><RemoveFormatting className="h-4 w-4" /></button>
        <button type="button" title={sourceMode ? "Visual editor" : "Edit HTML"} className={cn(btn, "ml-auto", sourceMode && "bg-charcoal !text-white hover:bg-charcoal")} onMouseDown={(e) => e.preventDefault()} onClick={() => { if (!sourceMode) emit(); setSourceMode((v) => !v); }}><Code className="h-4 w-4" /></button>
      </div>

      {/* Editing surface */}
      {sourceMode ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-3 text-xs font-mono text-charcoal outline-none resize-y"
          style={{ minHeight }}
          placeholder="<p>HTML source…</p>"
        />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={emit}
          onBlur={emit}
          onKeyDown={onKeyDown}
          onKeyUp={refresh}
          onMouseUp={refresh}
          data-placeholder={placeholder || "Write your message…"}
          className="rte-editable prose prose-sm max-w-none p-3 text-sm text-charcoal outline-none [&_a]:text-secondary [&_a]:underline"
          style={{ minHeight }}
        />
      )}

      {/* Link dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader><DialogTitle>Insert link</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input label="URL" placeholder="https://chinexabd.com/…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") insertLink(); }} />
            {!savedRange.current?.toString() && (
              <Input label="Link text" placeholder="Shop now" value={linkText} onChange={(e) => setLinkText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") insertLink(); }} />
            )}
            <p className="text-[11px] text-charcoal-lighter">Use full URLs — relative links don&apos;t work in email.</p>
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setLinkOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={insertLink} disabled={!linkUrl.trim()}>Insert</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image / GIF dialog */}
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Insert image / GIF</DialogTitle>
            <DialogDescription>Upload a file or paste an image URL. Animated GIFs are supported.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Upload */}
            <div>
              <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImageFile(f); }} />
              <button
                type="button" onClick={() => fileRef.current?.click()} disabled={imageUploading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-4 text-sm text-charcoal-lighter transition-colors hover:border-secondary hover:text-charcoal disabled:opacity-60"
              >
                {imageUploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><UploadCloud className="h-4 w-4" /> Upload from computer</>}
              </button>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-charcoal-lighter"><span className="h-px flex-1 bg-border/50" /> or <span className="h-px flex-1 bg-border/50" /></div>
            <Input label="Image URL" placeholder="https://…/promo.gif" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="preview" className="max-h-40 w-auto rounded-lg border border-border/40" />
            )}
            <Input label="Alt text (optional)" placeholder="Summer sale banner" value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Size</label>
              <div className="flex gap-1.5">
                {([["full", "Full width"], ["half", "Half"], ["auto", "Original"]] as const).map(([k, lbl]) => (
                  <button key={k} type="button" onClick={() => setImageWidth(k)}
                    className={cn("flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors", imageWidth === k ? "border-secondary bg-secondary/10 text-charcoal" : "border-border/50 text-charcoal-lighter hover:bg-pearl")}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            {imageError && <p className="text-xs text-destructive">{imageError}</p>}
            <p className="text-[11px] text-charcoal-lighter">Images are hosted on your domain so email clients can load them.</p>
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setImageOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={insertImage} disabled={!imageUrl.trim() || imageUploading}>Insert image</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
