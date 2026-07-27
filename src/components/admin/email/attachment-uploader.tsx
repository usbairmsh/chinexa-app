"use client";

import { useRef, useState } from "react";
import { Paperclip, X, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StagedAttachment {
  id: string; filename: string; mime_type: string; size: number; url: string;
}

// Uploads files against a compose token so they can be linked to the message /
// draft when it's sent/saved. Shows the staged files with a remove control.
export function AttachmentUploader({ composeToken, attachments, onChange }: {
  composeToken: string;
  attachments: StagedAttachment[];
  onChange: (next: StagedAttachment[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const pick = () => inputRef.current?.click();

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true); setError("");
    const added: StagedAttachment[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("compose_token", composeToken);
      const res = await fetch("/api/admin-email/attachments", { method: "POST", body: fd });
      if (res.ok) {
        const d = await res.json();
        if (d.attachment) added.push(d.attachment);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Could not upload ${file.name}`);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (added.length) onChange([...attachments, ...added]);
  };

  const remove = async (a: StagedAttachment) => {
    await fetch(`/api/admin-email/attachments?id=${a.id}`, { method: "DELETE" });
    onChange(attachments.filter((x) => x.id !== a.id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button" onClick={pick} disabled={uploading}
          className={cn("inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs font-medium text-charcoal-lighter transition-colors hover:bg-pearl hover:text-charcoal", uploading && "opacity-60")}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          Attach files
        </button>
        <span className="text-[11px] text-charcoal-lighter">Images, PDF, Word, Excel, txt, csv, zip · max 10MB each</span>
      </div>
      <input ref={inputRef} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)}
        accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" />
      {error && <p className="text-xs text-destructive">{error}</p>}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-pearl px-2.5 py-1 text-[11px] text-charcoal">
              <FileText className="h-3 w-3 text-charcoal-lighter" />
              <span className="max-w-[160px] truncate">{a.filename}</span>
              <span className="text-charcoal-lighter">{fmtSize(a.size)}</span>
              <button type="button" onClick={() => remove(a)} className="text-charcoal-lighter hover:text-destructive"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
