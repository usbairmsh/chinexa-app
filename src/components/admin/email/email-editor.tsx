"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3, Pilcrow,
  List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight, Link2, Link2Off,
  Minus, RemoveFormatting, Undo2, Redo2, Code, Baseline,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { cn } from "@/lib/utils";

// Purpose-built rich text editor for composing email (replies, broadcasts,
// promos). Robust for use inside modals:
//   • content is UNCONTROLLED — innerHTML is set once on mount and only re-seeded
//     when `resetKey` changes (parent bumps it to clear/reload). This removes the
//     caret-jumping and lost-keystrokes bugs of value-synced contentEditable.
//   • links use absolute URLs (relative internal links don't work in inboxes).

const PALETTE = ["#2f3b3a", "#BC4A72", "#C79A42", "#159A8C", "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#0f172a", "#6b7280"];

export function EmailEditor({ value, onChange, resetKey = 0, placeholder, minHeight = 220 }: {
  value: string;
  onChange: (html: string) => void;
  /** Bump to force the editor to re-seed from `value` (e.g. clear after send). */
  resetKey?: number;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
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
    restoreSelection();
    exec("foreColor", color);
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
          <button type="button" title="Text color" className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => { saveSelection(); setColorOpen((v) => !v); }}><Baseline className="h-4 w-4" /></button>
          {colorOpen && (
            <div className="absolute left-0 top-9 z-50 grid grid-cols-5 gap-1 rounded-lg border border-border/50 bg-card p-2 shadow-luxury-hover">
              {PALETTE.map((c) => (
                <button key={c} type="button" className="h-5 w-5 rounded-full border border-border/40" style={{ background: c }} onMouseDown={(e) => e.preventDefault()} onClick={() => applyColor(c)} title={c} />
              ))}
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
    </div>
  );
}
