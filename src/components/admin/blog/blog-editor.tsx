"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3, Pilcrow,
  List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight, Link2, Link2Off,
  Minus, RemoveFormatting, Undo2, Redo2, Code, Baseline, ImagePlus, Loader2,
  UploadCloud, Trash2, Table as TableIcon, Type,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { cn } from "@/lib/utils";

// Full-featured blog content editor. Built on the same contentEditable core as
// the email editor but with a richer toolbar: text size, font family, a larger
// color palette, image positioning (float left/right/center/full), and table
// insertion. Emits HTML via onChange; nothing is uploaded or saved here — the
// parent page persists only on Publish/Save-Draft.

const siteOrigin = () => (typeof window !== "undefined" ? window.location.origin : "");
function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${siteOrigin()}${url.startsWith("/") ? "" : "/"}${url}`;
}

const COLORS = [
  "#2f3b3a", "#BC4A72", "#C79A42", "#159A8C", "#2563eb", "#dc2626", "#16a34a", "#9333ea",
  "#0f172a", "#6b7280", "#ea580c", "#0891b2", "#be185d", "#4d7c0f", "#000000", "#ffffff",
];
const FONTS = [
  { label: "Default", value: "" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Sans", value: "Arial, Helvetica, sans-serif" },
  { label: "Mono", value: "'Courier New', monospace" },
  { label: "Elegant", value: "'Playfair Display', Georgia, serif" },
];
const SIZES = [
  { label: "Small", value: "0.85em" },
  { label: "Normal", value: "1em" },
  { label: "Large", value: "1.35em" },
  { label: "X-Large", value: "1.75em" },
];

export function BlogEditor({ value, onChange, placeholder, minHeight = 420, onImageUploaded }: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** Called with each freshly-uploaded inline image URL, so the parent can
   *  clean up images that never make it into a published/saved post. */
  onImageUploaded?: (url: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [lastColor, setLastColor] = useState("#BC4A72");
  // Image dialog
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  // Table dialog
  const [tableOpen, setTableOpen] = useState(false);
  const [tableRows, setTableRows] = useState("3");
  const [tableCols, setTableCols] = useState("3");
  // Selected inline image
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [imgBar, setImgBar] = useState<{ top: number; left: number } | null>(null);
  const [, force] = useState(0);
  const refresh = useCallback(() => force((n) => n + 1), []);

  useEffect(() => {
    const el = ref.current;
    if (el && !sourceMode && el.innerHTML !== (value || "") && document.activeElement !== el) {
      el.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, sourceMode]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("img").forEach((img) => { img.style.outline = ""; img.style.outlineOffset = ""; });
    const html = clone.innerHTML;
    onChange(html === "<br>" || html === "<div><br></div>" ? "" : html);
  };

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    try { document.execCommand("styleWithCSS", false, "true"); } catch {}
    document.execCommand(command, false, arg);
    emit(); refresh();
  };
  const isActive = (cmd: string) => { try { return document.queryCommandState(cmd); } catch { return false; } };
  const currentBlock = (): string => {
    try { return String(document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, ""); } catch { return ""; }
  };
  const blockActive = (tag: string) => currentBlock() === tag;
  const toggleBlock = (tag: string) => {
    ref.current?.focus();
    document.execCommand("formatBlock", false, currentBlock() === tag ? "p" : tag);
    emit(); refresh();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    clearImageSelection();
    if (e.key === "Enter" && !e.shiftKey && currentBlock() === "blockquote") {
      const sel = window.getSelection();
      if ((sel?.anchorNode?.textContent ?? "").trim() === "") {
        e.preventDefault();
        document.execCommand("formatBlock", false, "p");
        emit(); refresh();
      }
    }
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    savedRange.current = sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  };
  const restoreSelection = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (sel && savedRange.current) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
  };

  // ── Wrap the current selection in a styled span (size / font) ──
  const wrapSelectionStyle = (style: Partial<CSSStyleDeclaration>) => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    Object.assign(span.style, style);
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      // Re-select the wrapped content.
      const r = document.createRange();
      r.selectNodeContents(span);
      sel.removeAllRanges(); sel.addRange(r);
    } catch {}
    emit(); refresh();
  };
  const applySize = (size: string) => { setSizeOpen(false); restoreSelection(); wrapSelectionStyle({ fontSize: size }); };
  const applyFont = (font: string) => { setFontOpen(false); restoreSelection(); if (font) wrapSelectionStyle({ fontFamily: font }); else exec("removeFormat"); };

  const openLink = () => {
    saveSelection();
    setLinkText(savedRange.current && !savedRange.current.collapsed ? savedRange.current.toString() : "");
    setLinkUrl("https://"); setLinkOpen(true);
  };
  const insertLink = () => {
    let href = linkUrl.trim();
    if (!href) return;
    if (!/^(https?:|mailto:|tel:|\/)/i.test(href)) href = `https://${href.replace(/^\/+/, "")}`;
    restoreSelection();
    if (savedRange.current && !savedRange.current.collapsed) {
      document.execCommand("createLink", false, href);
    } else {
      const text = (linkText.trim() || href).replace(/</g, "&lt;").replace(/>/g, "&gt;");
      document.execCommand("insertHTML", false, `<a href="${href.replace(/"/g, "&quot;")}">${text}</a>`);
    }
    setLinkOpen(false); emit(); refresh();
  };

  const applyColor = (c: string) => { setColorOpen(false); setLastColor(c); restoreSelection(); exec("foreColor", c); };

  // ── Image insert ──
  const openImage = () => { saveSelection(); setImageUrl(""); setImageAlt(""); setImageError(""); setImageOpen(true); };
  const uploadImageFile = async (file: File) => {
    setImageUploading(true); setImageError("");
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("folder", "blog");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setImageError(d.error || "Upload failed"); return; }
      setImageUrl(absoluteUrl(d.url));
      if (d.url) onImageUploaded?.(d.url); // track for abandon-cleanup

    } catch { setImageError("Upload failed"); }
    finally { setImageUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const insertImage = () => {
    const src = absoluteUrl(imageUrl.trim());
    if (!src) return;
    const img = `<img src="${src.replace(/"/g, "&quot;")}" alt="${imageAlt.replace(/"/g, "&quot;")}" style="width:100%;max-width:100%;height:auto;display:block;margin:12px auto;border-radius:8px;" />`;
    restoreSelection();
    document.execCommand("insertHTML", false, img);
    setImageOpen(false); emit(); refresh();
  };

  // ── Image selection / resize / position / delete ──
  const positionImgBar = (img: HTMLImageElement) => {
    const box = ref.current?.getBoundingClientRect();
    const r = img.getBoundingClientRect();
    if (box) setImgBar({ top: r.top - box.top, left: r.left - box.left });
  };
  const selectImage = (img: HTMLImageElement) => {
    ref.current?.querySelectorAll("img").forEach((el) => { el.style.outline = ""; el.style.outlineOffset = ""; });
    img.style.outline = "2px solid #159A8C"; img.style.outlineOffset = "2px";
    setSelectedImg(img); positionImgBar(img);
  };
  const clearImageSelection = () => {
    ref.current?.querySelectorAll("img").forEach((el) => { el.style.outline = ""; el.style.outlineOffset = ""; });
    setSelectedImg(null); setImgBar(null);
  };
  const onSurfaceClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === "IMG") selectImage(t as HTMLImageElement); else clearImageSelection();
  };
  const resizeSelected = (w: "25" | "50" | "75" | "100") => {
    if (!selectedImg) return;
    selectedImg.style.width = `${w}%`; selectedImg.style.maxWidth = `${w}%`; selectedImg.style.height = "auto";
    positionImgBar(selectedImg); emit(); refresh();
  };
  const positionSelected = (pos: "left" | "center" | "right" | "full") => {
    if (!selectedImg) return;
    const img = selectedImg;
    img.style.height = "auto";
    if (pos === "left") { img.style.float = "left"; img.style.display = "inline"; img.style.margin = "6px 16px 6px 0"; img.style.maxWidth = "45%"; img.style.width = "45%"; }
    else if (pos === "right") { img.style.float = "right"; img.style.display = "inline"; img.style.margin = "6px 0 6px 16px"; img.style.maxWidth = "45%"; img.style.width = "45%"; }
    else if (pos === "center") { img.style.float = "none"; img.style.display = "block"; img.style.margin = "12px auto"; img.style.maxWidth = "80%"; img.style.width = "80%"; }
    else { img.style.float = "none"; img.style.display = "block"; img.style.margin = "12px auto"; img.style.maxWidth = "100%"; img.style.width = "100%"; }
    positionImgBar(img); emit(); refresh();
  };
  const deleteSelected = () => { if (selectedImg) { selectedImg.remove(); clearImageSelection(); emit(); refresh(); } };

  // ── Table insert ──
  const insertTable = () => {
    const rows = Math.min(20, Math.max(1, Number(tableRows) || 3));
    const cols = Math.min(10, Math.max(1, Number(tableCols) || 3));
    let html = `<table style="width:100%;border-collapse:collapse;margin:16px 0;" border="1"><tbody>`;
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        const tag = r === 0 ? "th" : "td";
        html += `<${tag} style="border:1px solid #d8c9d4;padding:8px;text-align:left;">${r === 0 ? "Heading" : "&nbsp;"}</${tag}>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table><p><br></p>";
    restoreSelection();
    document.execCommand("insertHTML", false, html);
    setTableOpen(false); emit(); refresh();
  };

  const btn = "flex h-8 w-8 items-center justify-center rounded-md text-charcoal-lighter transition-colors hover:bg-pearl hover:text-charcoal active:scale-[0.94]";
  const activeCls = "!bg-charcoal !text-white hover:!bg-charcoal";
  const sep = <span className="mx-0.5 h-5 w-px bg-border/50" />;
  const noBlur = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="rounded-lg border border-border focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20">
      {/* Toolbar — sticks to the top of the scroll container so it stays
          reachable while writing a long post. */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-border/40 bg-pearl px-2 py-1.5">
        <button type="button" title="Undo" className={btn} onMouseDown={noBlur} onClick={() => exec("undo")}><Undo2 className="h-4 w-4" /></button>
        <button type="button" title="Redo" className={btn} onMouseDown={noBlur} onClick={() => exec("redo")}><Redo2 className="h-4 w-4" /></button>
        {sep}
        <button type="button" title="Heading 1" className={cn(btn, blockActive("h1") && activeCls)} onMouseDown={noBlur} onClick={() => toggleBlock("h1")}><Heading1 className="h-4 w-4" /></button>
        <button type="button" title="Heading 2" className={cn(btn, blockActive("h2") && activeCls)} onMouseDown={noBlur} onClick={() => toggleBlock("h2")}><Heading2 className="h-4 w-4" /></button>
        <button type="button" title="Heading 3" className={cn(btn, blockActive("h3") && activeCls)} onMouseDown={noBlur} onClick={() => toggleBlock("h3")}><Heading3 className="h-4 w-4" /></button>
        <button type="button" title="Paragraph" className={cn(btn, blockActive("p") && activeCls)} onMouseDown={noBlur} onClick={() => exec("formatBlock", "p")}><Pilcrow className="h-4 w-4" /></button>
        {/* Text size */}
        <div className="relative">
          <button type="button" title="Text size" className={btn} onMouseDown={noBlur} onClick={() => { saveSelection(); setSizeOpen((v) => !v); }}><Type className="h-4 w-4" /></button>
          {sizeOpen && (
            <div className="absolute left-0 top-9 z-50 w-32 rounded-lg border border-border/50 bg-card p-1 shadow-luxury-hover">
              {SIZES.map((s) => <button key={s.value} type="button" className="block w-full rounded px-2 py-1 text-left text-xs text-charcoal-lighter hover:bg-pearl hover:text-charcoal" onMouseDown={noBlur} onClick={() => applySize(s.value)} style={{ fontSize: s.value === "1em" ? undefined : s.value }}>{s.label}</button>)}
            </div>
          )}
        </div>
        {/* Font family */}
        <div className="relative">
          <button type="button" title="Font" className={cn(btn, "w-auto px-1.5 text-[11px]")} onMouseDown={noBlur} onClick={() => { saveSelection(); setFontOpen((v) => !v); }}>Font</button>
          {fontOpen && (
            <div className="absolute left-0 top-9 z-50 w-36 rounded-lg border border-border/50 bg-card p-1 shadow-luxury-hover">
              {FONTS.map((f) => <button key={f.label} type="button" className="block w-full rounded px-2 py-1 text-left text-xs text-charcoal-lighter hover:bg-pearl hover:text-charcoal" onMouseDown={noBlur} onClick={() => applyFont(f.value)} style={{ fontFamily: f.value || undefined }}>{f.label}</button>)}
            </div>
          )}
        </div>
        {sep}
        <button type="button" title="Bold" className={cn(btn, isActive("bold") && activeCls)} onMouseDown={noBlur} onClick={() => exec("bold")}><Bold className="h-4 w-4" /></button>
        <button type="button" title="Italic" className={cn(btn, isActive("italic") && activeCls)} onMouseDown={noBlur} onClick={() => exec("italic")}><Italic className="h-4 w-4" /></button>
        <button type="button" title="Underline" className={cn(btn, isActive("underline") && activeCls)} onMouseDown={noBlur} onClick={() => exec("underline")}><Underline className="h-4 w-4" /></button>
        <button type="button" title="Strikethrough" className={cn(btn, isActive("strikeThrough") && activeCls)} onMouseDown={noBlur} onClick={() => exec("strikeThrough")}><Strikethrough className="h-4 w-4" /></button>
        {/* Color */}
        <div className="relative">
          <button type="button" title="Text color" className={cn(btn, "flex-col !gap-0", colorOpen && activeCls)} onMouseDown={noBlur} onClick={() => { saveSelection(); setColorOpen((v) => !v); }}>
            <Baseline className="h-4 w-3.5" /><span className="h-[3px] w-4 rounded-full" style={{ background: lastColor }} />
          </button>
          {colorOpen && (
            <div className="absolute left-0 top-9 z-50 w-48 rounded-lg border border-border/50 bg-card p-2 shadow-luxury-hover">
              <div className="grid grid-cols-8 gap-1">
                {COLORS.map((c) => <button key={c} type="button" className="h-5 w-5 rounded-full border border-border/40 hover:scale-110 transition-transform" style={{ background: c }} onMouseDown={noBlur} onClick={() => applyColor(c)} title={c} />)}
              </div>
              <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[11px] text-charcoal-lighter hover:bg-pearl" onMouseDown={noBlur}>
                <span className="inline-block h-4 w-4 rounded-full border border-border/40" style={{ background: lastColor }} /> Custom…
                <input type="color" value={lastColor} className="ml-auto h-5 w-6 cursor-pointer border-0 bg-transparent p-0" onChange={(e) => applyColor(e.target.value)} />
              </label>
            </div>
          )}
        </div>
        {sep}
        <button type="button" title="Bullet list" className={cn(btn, isActive("insertUnorderedList") && activeCls)} onMouseDown={noBlur} onClick={() => exec("insertUnorderedList")}><List className="h-4 w-4" /></button>
        <button type="button" title="Numbered list" className={cn(btn, isActive("insertOrderedList") && activeCls)} onMouseDown={noBlur} onClick={() => exec("insertOrderedList")}><ListOrdered className="h-4 w-4" /></button>
        <button type="button" title="Quote" className={cn(btn, blockActive("blockquote") && activeCls)} onMouseDown={noBlur} onClick={() => toggleBlock("blockquote")}><Quote className="h-4 w-4" /></button>
        {sep}
        <button type="button" title="Align left" className={cn(btn, isActive("justifyLeft") && activeCls)} onMouseDown={noBlur} onClick={() => exec("justifyLeft")}><AlignLeft className="h-4 w-4" /></button>
        <button type="button" title="Align center" className={cn(btn, isActive("justifyCenter") && activeCls)} onMouseDown={noBlur} onClick={() => exec("justifyCenter")}><AlignCenter className="h-4 w-4" /></button>
        <button type="button" title="Align right" className={cn(btn, isActive("justifyRight") && activeCls)} onMouseDown={noBlur} onClick={() => exec("justifyRight")}><AlignRight className="h-4 w-4" /></button>
        {sep}
        <button type="button" title="Insert link" className={cn(btn, isActive("createLink") && activeCls)} onMouseDown={noBlur} onClick={openLink}><Link2 className="h-4 w-4" /></button>
        <button type="button" title="Remove link" className={btn} onMouseDown={noBlur} onClick={() => exec("unlink")}><Link2Off className="h-4 w-4" /></button>
        <button type="button" title="Insert image" className={btn} onMouseDown={noBlur} onClick={openImage}><ImagePlus className="h-4 w-4" /></button>
        <button type="button" title="Insert table" className={btn} onMouseDown={noBlur} onClick={() => { saveSelection(); setTableOpen(true); }}><TableIcon className="h-4 w-4" /></button>
        <button type="button" title="Horizontal line" className={btn} onMouseDown={noBlur} onClick={() => exec("insertHorizontalRule")}><Minus className="h-4 w-4" /></button>
        <button type="button" title="Clear formatting" className={btn} onMouseDown={noBlur} onClick={() => exec("removeFormat")}><RemoveFormatting className="h-4 w-4" /></button>
        <button type="button" title={sourceMode ? "Visual" : "HTML"} className={cn(btn, "ml-auto", sourceMode && activeCls)} onMouseDown={noBlur} onClick={() => { clearImageSelection(); if (!sourceMode) emit(); setSourceMode((v) => !v); }}><Code className="h-4 w-4" /></button>
      </div>

      {/* Surface */}
      {sourceMode ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} className="w-full p-3 text-xs font-mono text-charcoal outline-none resize-y" style={{ minHeight }} placeholder="<p>HTML source…</p>" />
      ) : (
        <div className="relative">
          <div
            ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true"
            onInput={emit} onBlur={emit} onKeyDown={onKeyDown} onKeyUp={refresh} onMouseUp={refresh} onClick={onSurfaceClick}
            data-placeholder={placeholder || "Write your post…"}
            className="rte-editable prose prose-sm sm:prose-base max-w-none p-4 text-charcoal outline-none [&_a]:text-secondary [&_a]:underline [&_table]:border-collapse [&_td]:border [&_th]:border [&_td]:border-border/40 [&_th]:border-border/40 [&_td]:p-2 [&_th]:p-2"
            style={{ minHeight }}
          />
          {selectedImg && imgBar && (
            <div className="absolute z-30 flex items-center gap-0.5 rounded-lg border border-border/50 bg-card px-1 py-0.5 shadow-luxury-hover" style={{ top: Math.max(0, imgBar.top - 38), left: imgBar.left }} onMouseDown={noBlur}>
              <span className="px-1 text-[9px] font-semibold uppercase text-charcoal-lighter">W</span>
              <button type="button" className="rounded px-1 py-1 text-[10px] font-medium text-charcoal-lighter hover:bg-pearl hover:text-charcoal" onClick={() => resizeSelected("25")}>25</button>
              <button type="button" className="rounded px-1 py-1 text-[10px] font-medium text-charcoal-lighter hover:bg-pearl hover:text-charcoal" onClick={() => resizeSelected("50")}>50</button>
              <button type="button" className="rounded px-1 py-1 text-[10px] font-medium text-charcoal-lighter hover:bg-pearl hover:text-charcoal" onClick={() => resizeSelected("100")}>100</button>
              <span className="mx-0.5 h-4 w-px bg-border/50" />
              <button type="button" title="Float left" className="rounded p-1 text-charcoal-lighter hover:bg-pearl hover:text-charcoal" onClick={() => positionSelected("left")}><AlignLeft className="h-3.5 w-3.5" /></button>
              <button type="button" title="Center" className="rounded p-1 text-charcoal-lighter hover:bg-pearl hover:text-charcoal" onClick={() => positionSelected("center")}><AlignCenter className="h-3.5 w-3.5" /></button>
              <button type="button" title="Float right" className="rounded p-1 text-charcoal-lighter hover:bg-pearl hover:text-charcoal" onClick={() => positionSelected("right")}><AlignRight className="h-3.5 w-3.5" /></button>
              <button type="button" title="Full width" className="rounded px-1 py-1 text-[10px] font-medium text-charcoal-lighter hover:bg-pearl hover:text-charcoal" onClick={() => positionSelected("full")}>Full</button>
              <span className="mx-0.5 h-4 w-px bg-border/50" />
              <button type="button" title="Remove image" className="rounded p-1 text-charcoal-lighter hover:bg-destructive/10 hover:text-destructive" onClick={deleteSelected}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>
      )}

      {/* Link dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader><DialogTitle>Insert link</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input label="URL" placeholder="https://… or /products/slug" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") insertLink(); }} />
            {!savedRange.current?.toString() && <Input label="Link text" value={linkText} onChange={(e) => setLinkText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") insertLink(); }} />}
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setLinkOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={insertLink} disabled={!linkUrl.trim()}>Insert</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image dialog */}
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader><DialogTitle>Insert image</DialogTitle><DialogDescription>Upload or paste an image URL.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImageFile(f); }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={imageUploading} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-4 text-sm text-charcoal-lighter hover:border-secondary hover:text-charcoal disabled:opacity-60">
              {imageUploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><UploadCloud className="h-4 w-4" /> Upload from computer</>}
            </button>
            <Input label="Image URL" placeholder="https://…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            {imageUrl && (/* eslint-disable-next-line @next/next/no-img-element */ <img src={imageUrl} alt="preview" className="max-h-40 w-auto rounded-lg border border-border/40" />)}
            <Input label="Alt text (SEO)" placeholder="Describe the image" value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} />
            {imageError && <p className="text-xs text-destructive">{imageError}</p>}
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setImageOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={insertImage} disabled={!imageUrl.trim() || imageUploading}>Insert</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table dialog */}
      <Dialog open={tableOpen} onOpenChange={setTableOpen}>
        <DialogContent className="w-[95vw] max-w-xs">
          <DialogHeader><DialogTitle>Insert table</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Rows" type="number" value={tableRows} onChange={(e) => setTableRows(e.target.value)} />
            <Input label="Columns" type="number" value={tableCols} onChange={(e) => setTableCols(e.target.value)} />
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setTableOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={insertTable}>Insert</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
