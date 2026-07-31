"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Mail, Send, Loader2, Inbox, ArrowDownLeft, ArrowUpRight, Plus, Trash2,
  Megaphone, Settings2, RefreshCw, Check, Reply, FileText, Save, RotateCcw, Paperclip, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { EmailEditor } from "@/components/admin/email/email-editor";
import { AttachmentUploader, type StagedAttachment } from "@/components/admin/email/attachment-uploader";
import { useAdmin } from "@/contexts/admin-context";

// Client-side compose token — groups uploaded attachments before the message
// or draft exists, so they can be linked to it on send/save.
function makeComposeToken() {
  return `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Discard staged uploads (inline images + attachments) for an abandoned compose
// — the modal was closed without sending or saving. Best-effort.
async function discardCompose(token: string) {
  if (!token) return;
  try {
    await fetch("/api/admin-email/discard", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compose_token: token }),
    });
  } catch { /* best-effort */ }
}

interface Mailbox {
  id: string; address: string; display_name: string;
  is_active: boolean; can_receive: boolean; can_send: boolean; can_broadcast: boolean;
}
interface Thread {
  id: string; mailbox_id: string; correspondent: string; correspondent_name: string | null;
  subject: string; status: "open" | "closed"; admin_unread: number; message_count: number; last_message_at: string;
}
interface Attachment { id: string; filename: string; mime_type: string; size: number; url: string; direction: string }
interface Message {
  id: string; direction: "inbound" | "outbound"; from_address: string; to_address: string;
  subject: string; body_html: string | null; body_text: string | null; created_at: string;
  attachments?: Attachment[];
}
interface Draft {
  id: string; kind: "reply" | "broadcast"; mailbox_id: string | null; thread_id: string | null;
  from_address: string | null; to_address: string | null; subject: string; body_text: string | null;
  segment: { type?: string; value?: number } | null; created_at: string; updated_at: string;
}
interface Counts { sent: number; received: number; broadcast: number; total: number; unread: number }

const fmtTime = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

// Basic sanitizer for rendering email HTML in the thread view. Inbound HTML
// comes from external senders, so strip script/style/iframe, inline event
// handlers, and javascript: URLs before injecting. (Admin-only surface; this is
// defense-in-depth, not a full sanitizer library.)
function sanitizeEmailHtml(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
}

// Sentinel for the fixed Drafts inbox in the mailbox rail.
const DRAFTS = "__drafts__";

export default function EmailCenterPage() {
  const { can, role, adminId } = useAdmin();
  const isSuper = role === "superadmin" || role === "system_admin";
  const canSend = can("email_inbox", "add");
  const canDraft = can("email_inbox", "draft");
  const canDelete = can("email_inbox", "delete");
  const canBroadcast = can("email_inbox", "broadcast");
  const canManageMailboxes = can("email_inbox", "manage_mailboxes");

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selected, setSelected] = useState<string>(""); // "" = all, mailbox id, or DRAFTS
  const [threads, setThreads] = useState<Thread[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftCount, setDraftCount] = useState(0);
  const [totals, setTotals] = useState<Counts>({ sent: 0, received: 0, broadcast: 0, total: 0, unread: 0 });
  const [counts, setCounts] = useState<Counts>({ sent: 0, received: 0, broadcast: 0, total: 0, unread: 0 });
  const [loading, setLoading] = useState(true);
  const [footerText, setFooterText] = useState("");

  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadMailbox, setThreadMailbox] = useState<Mailbox | null>(null);

  const [mailboxDialog, setMailboxDialog] = useState(false);
  const [broadcastDialog, setBroadcastDialog] = useState(false);
  const [composeDialog, setComposeDialog] = useState(false);
  const [replyModal, setReplyModal] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const mid = selected && selected !== DRAFTS ? selected : "";
    const [dashRes, footerRes] = await Promise.all([
      // no-store: this list must always reflect the DB — a browser-cached copy
      // made a newly-created mailbox look missing (it was saved, just not shown).
      fetch(`/api/admin-email${mid ? `?mailbox_id=${mid}` : ""}`, { cache: "no-store" }),
      fetch("/api/settings?key=email_footer"),
    ]);
    if (dashRes.ok) {
      const data = await dashRes.json();
      setMailboxes(data.mailboxes || []);
      setThreads(data.threads || []);
      setCounts(data.counts);
      setTotals(data.totals);
      setDraftCount(data.draft_count || 0);
    }
    if (footerRes.ok) {
      const f = await footerRes.json();
      if (typeof f?.value === "string") setFooterText(f.value);
    }
    setLoading(false);
    // adminId is in the deps so this re-runs once the admin context finishes
    // loading (it starts empty and fills in from an async whoami fetch). Without
    // it, the first load() fired before the admin was ready and its mailbox list
    // never rendered — the list only appeared after clicking a mailbox happened
    // to change `selected` and re-trigger load(). Keying on adminId fixes the
    // initial page load / refresh.
  }, [selected, adminId]);

  const loadDrafts = useCallback(async () => {
    if (!canDraft) return;
    const res = await fetch("/api/admin-email/drafts");
    if (res.ok) { const d = await res.json(); setDrafts(d.drafts || []); }
  }, [canDraft]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (selected === DRAFTS) loadDrafts(); }, [selected, loadDrafts]);

  const openThread = async (t: Thread) => {
    setActiveThread(t);
    setMessages([]);
    const res = await fetch(`/api/admin-email/threads/${t.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages || []);
    setThreadMailbox(data.mailbox || null);
    setThreads((prev) => prev.map((x) => (x.id === t.id ? { ...x, admin_unread: 0 } : x)));
  };

  const deleteThread = async (t: Thread) => {
    if (!confirm(`Delete this entire email thread with ${t.correspondent}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin-email/threads/${t.id}`, { method: "DELETE" });
    if (res.ok) {
      setThreads((prev) => prev.filter((x) => x.id !== t.id));
      if (activeThread?.id === t.id) setActiveThread(null);
      load();
    }
  };

  const deleteMessage = async (m: Message) => {
    if (!confirm(`Delete this ${m.direction === "outbound" ? "sent" : "received"} message? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin-email/messages/${m.id}`, { method: "DELETE" });
    if (!res.ok) return;
    const r = await res.json().catch(() => ({}));
    if (r.thread_deleted && activeThread) {
      // That was the last message — the thread is gone.
      setThreads((prev) => prev.filter((x) => x.id !== activeThread.id));
      setActiveThread(null);
    } else {
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
    }
    load();
  };

  const resetCounts = async () => {
    if (!confirm("Reset the Sent / Received / Broadcast / Total counts to zero? This doesn't delete any emails.")) return;
    const res = await fetch("/api/admin-email/reset-counters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (res.ok) load();
  };

  // The most recent message in the open thread — used to pre-fill the reply's To.
  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");

  const StatCard = ({ icon: Icon, label, value, tone }: { icon: typeof Mail; label: string; value: number; tone: string }) => (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", tone)}><Icon className="h-4 w-4" /></div>
      <div>
        <p className="text-lg font-semibold leading-none text-charcoal tabular-nums">{value.toLocaleString()}</p>
        <p className="text-[11px] text-charcoal-lighter mt-1">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-charcoal flex items-center gap-2"><Mail className="h-5 w-5 text-secondary" /> Email Center</h1>
          <p className="text-sm text-charcoal-lighter">Receive, reply to, and broadcast email across your mailboxes.</p>
        </div>
        <div className="flex items-center gap-2">
          <AdminButton variant="outline" size="sm" onClick={() => { load(); loadDrafts(); }}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh</AdminButton>
          {canSend && <AdminButton variant="outline" size="sm" onClick={() => setComposeDialog(true)}><Send className="h-3.5 w-3.5 mr-1" /> New Email</AdminButton>}
          {canBroadcast && <AdminButton variant="outline" size="sm" onClick={() => setBroadcastDialog(true)}><Megaphone className="h-3.5 w-3.5 mr-1" /> Broadcast</AdminButton>}
          {(isSuper || canManageMailboxes) && <AdminButton size="sm" onClick={() => setMailboxDialog(true)}><Settings2 className="h-3.5 w-3.5 mr-1" /> Mailboxes</AdminButton>}
        </div>
      </div>

      {/* Always-visible lifetime counters (persist across deletion) */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={ArrowUpRight} label="Sent" value={totals.sent} tone="bg-blue-50 text-blue-600" />
          <StatCard icon={ArrowDownLeft} label="Received" value={totals.received} tone="bg-emerald-50 text-emerald-600" />
          <StatCard icon={Megaphone} label="Broadcast sent" value={totals.broadcast} tone="bg-amber-50 text-amber-600" />
          <StatCard icon={Inbox} label="Total emails" value={totals.total} tone="bg-secondary/10 text-secondary" />
        </div>
        {canDelete && (
          <div className="flex justify-end">
            <button onClick={resetCounts} className="flex items-center gap-1 text-[11px] text-charcoal-lighter hover:text-destructive transition-colors">
              <RotateCcw className="h-3 w-3" /> Reset counts
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_320px_1fr] gap-4">
        {/* Mailbox rail */}
        <div className="rounded-xl border border-border/40 bg-card p-2 h-fit space-y-0.5">
          <RailButton active={selected === ""} onClick={() => { setSelected(""); setActiveThread(null); }} icon={Inbox} label="All mailboxes" />
          {mailboxes.map((m) => (
            <button
              key={m.id}
              onClick={() => { setSelected(m.id); setActiveThread(null); }}
              className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                selected === m.id ? "bg-primary-light text-charcoal font-medium" : "text-charcoal-lighter hover:bg-pearl")}
              title={m.address}
            >
              <span className="truncate text-left">
                <span className="block truncate">{m.display_name}</span>
                <span className="block truncate text-[10px] text-charcoal-lighter">{m.address}</span>
              </span>
              {!m.is_active && <span className="text-[9px] text-charcoal-lighter">off</span>}
            </button>
          ))}
          {/* Fixed Drafts inbox */}
          {canDraft && (
            <div className="pt-1 mt-1 border-t border-border/30">
              <button
                onClick={() => { setSelected(DRAFTS); setActiveThread(null); }}
                className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                  selected === DRAFTS ? "bg-primary-light text-charcoal font-medium" : "text-charcoal-lighter hover:bg-pearl")}
              >
                <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Drafts</span>
                {draftCount > 0 && <span className="rounded-full bg-secondary/15 px-1.5 py-0.5 text-[9px] font-medium text-secondary">{draftCount}</span>}
              </button>
            </div>
          )}
          {mailboxes.length === 0 && !loading && (
            <p className="px-3 py-4 text-center text-xs text-charcoal-lighter">No mailboxes yet.{isSuper && " Add one to start receiving."}</p>
          )}
        </div>

        {/* Middle column: thread list OR drafts list */}
        {selected === DRAFTS ? (
          <DraftsList drafts={drafts} mailboxes={mailboxes} canSend={canSend} onEdit={(d) => setEditingDraft(d)} onChanged={() => { loadDrafts(); load(); }} />
        ) : (
          <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
            <div className="border-b border-border/30 px-3 py-2 text-xs font-medium text-charcoal-lighter flex items-center justify-between">
              <span>{threads.length} conversation{threads.length === 1 ? "" : "s"}</span>
              <span className="tabular-nums">{counts.unread > 0 ? `${counts.unread} unread` : ""}</span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/20">
              {loading && <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-charcoal-lighter" /></div>}
              {!loading && threads.length === 0 && <p className="p-6 text-center text-sm text-charcoal-lighter">No emails yet.</p>}
              {threads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openThread(t)}
                  className={cn("flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-pearl", activeThread?.id === t.id && "bg-pearl")}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className={cn("truncate text-sm", t.admin_unread > 0 ? "font-semibold text-charcoal" : "text-charcoal")}>
                      {t.correspondent_name || t.correspondent}
                    </span>
                    {/* Latest message timestamp, beside the address */}
                    <span className="shrink-0 text-[10px] text-charcoal-lighter tabular-nums">{fmtTime(t.last_message_at)}</span>
                  </div>
                  <span className="truncate text-[11px] text-charcoal-lighter w-full">{t.correspondent}</span>
                  <span className="truncate text-xs text-charcoal-lighter w-full">{t.subject}</span>
                  {t.admin_unread > 0 && <span className="mt-0.5 rounded-full bg-secondary/15 px-1.5 py-0.5 text-[9px] font-medium text-secondary">{t.admin_unread} new</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Thread view (redesigned): header block with From/To/Subject, then bodies */}
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden flex flex-col min-h-[50vh]">
          {selected === DRAFTS ? (
            <div className="flex flex-1 items-center justify-center text-center p-8">
              <div>
                <FileText className="h-8 w-8 mx-auto text-charcoal-lighter/50" />
                <p className="mt-2 text-sm text-charcoal-lighter">Select a draft to edit or send it.</p>
              </div>
            </div>
          ) : !activeThread ? (
            <div className="flex flex-1 items-center justify-center text-center p-8">
              <div>
                <Mail className="h-8 w-8 mx-auto text-charcoal-lighter/50" />
                <p className="mt-2 text-sm text-charcoal-lighter">Select a conversation to read it.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header block — From / To / Subject for the conversation */}
              <div className="border-b border-border/30 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5 text-xs">
                    <FieldLine label="From" value={activeThread.correspondent_name ? `${activeThread.correspondent_name} <${activeThread.correspondent}>` : activeThread.correspondent} />
                    <FieldLine label="To" value={threadMailbox?.address || ""} />
                    <FieldLine label="Subject" value={activeThread.subject} strong />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canSend && threadMailbox?.can_send && (
                      <AdminButton size="sm" onClick={() => setReplyModal(true)}><Reply className="h-3.5 w-3.5 mr-1" /> Reply</AdminButton>
                    )}
                    {canDelete && (
                      <button onClick={() => deleteThread(activeThread)} className="flex items-center gap-1 text-xs text-charcoal-lighter hover:text-destructive transition-colors" title="Delete the entire thread and all its messages">
                        <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Delete thread</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Message bodies — received + sent, in order, each with its timestamp */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[55vh]">
                {messages.length === 0 && <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto text-charcoal-lighter" /></div>}
                {messages.map((m) => (
                  <div key={m.id} className={cn("group rounded-xl border p-3", m.direction === "outbound" ? "border-secondary/20 bg-secondary/5" : "border-border/40 bg-pearl/40")}>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium">
                      {m.direction === "outbound"
                        ? <><ArrowUpRight className="h-3 w-3 text-secondary" /><span className="text-secondary">Sent</span><span className="text-charcoal-lighter">· {m.from_address} → {m.to_address}</span></>
                        : <><ArrowDownLeft className="h-3 w-3 text-emerald-600" /><span className="text-emerald-700">Received</span><span className="text-charcoal-lighter">· from {m.from_address}</span></>}
                      {canDelete && (
                        <button
                          onClick={() => deleteMessage(m)}
                          className="ml-auto text-charcoal-lighter opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          title="Delete this message"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {m.body_html && m.body_html.trim()
                      ? <div className="prose prose-sm max-w-none break-words text-sm text-charcoal [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(m.body_html) }} />
                      : (m.body_text && m.body_text.trim())
                        ? <div className="whitespace-pre-wrap break-words text-sm text-charcoal">{m.body_text}</div>
                        : <div className="text-sm italic text-charcoal-lighter">(This message has no readable text content.)</div>}

                    {/* Attachments */}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.attachments.map((a) => (
                          <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card px-2.5 py-1 text-[11px] text-charcoal hover:bg-pearl transition-colors">
                            <Paperclip className="h-3 w-3 text-charcoal-lighter" />
                            <span className="max-w-[180px] truncate">{a.filename}</span>
                          </a>
                        ))}
                      </div>
                    )}
                    {/* Per-message timestamp below the body */}
                    <div className="mt-2 text-right text-[10px] text-charcoal-lighter tabular-nums">{fmtTime(m.created_at)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reply modal */}
      {activeThread && threadMailbox && (
        <ReplyModal
          open={replyModal}
          onClose={() => setReplyModal(false)}
          mailbox={threadMailbox}
          thread={activeThread}
          toAddress={lastInbound?.from_address || activeThread.correspondent}
          footerText={footerText}
          canSend={canSend}
          canDraft={canDraft}
          onSent={() => { setReplyModal(false); openThread(activeThread); load(); }}
          onDrafted={() => { setReplyModal(false); loadDrafts(); load(); }}
        />
      )}

      {/* Edit-draft modal */}
      {editingDraft && (
        <DraftEditorModal
          draft={editingDraft}
          mailboxes={mailboxes}
          footerText={footerText}
          canSend={canSend}
          onClose={() => setEditingDraft(null)}
          onChanged={() => { setEditingDraft(null); loadDrafts(); load(); }}
        />
      )}

      {(isSuper || canManageMailboxes) && <MailboxDialog open={mailboxDialog} onClose={() => setMailboxDialog(false)} mailboxes={mailboxes} onChanged={load} />}
      {canSend && <ComposeDialog open={composeDialog} onClose={() => setComposeDialog(false)} mailboxes={mailboxes} footerText={footerText} onSent={() => { load(); }} />}
      {canBroadcast && <BroadcastDialog open={broadcastDialog} onClose={() => setBroadcastDialog(false)} mailboxes={mailboxes.filter((m) => m.can_broadcast)} footerText={footerText} canDraft={canDraft} onDrafted={() => { loadDrafts(); load(); }} />}
    </div>
  );
}

function RailButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Mail; label: string }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-primary-light text-charcoal font-medium" : "text-charcoal-lighter hover:bg-pearl")}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function FieldLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-14 shrink-0 text-charcoal-lighter">{label}</span>
      <span className={cn("min-w-0 break-words", strong ? "font-medium text-charcoal" : "text-charcoal")}>{value}</span>
    </div>
  );
}

// Read-only footer preview reused by every compose surface.
function FooterPreview({ footerText }: { footerText: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-charcoal-lighter mb-1">Footer (added automatically)</p>
      <div className="rounded-lg border border-border/40 bg-[#FDF4F8] p-3 text-left opacity-80">
        <div className="text-[#9A8592] text-[11px] leading-relaxed whitespace-pre-line">{footerText.trim() || "No footer configured (Settings → Notifications → Email Footer)."}</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="ChineXa" className="mt-2 inline-block h-6 w-auto" />
      </div>
    </div>
  );
}

// ─── Reply modal ───
function ReplyModal({ open, onClose, mailbox, thread, toAddress, footerText, canSend, canDraft, onSent, onDrafted }: {
  open: boolean; onClose: () => void; mailbox: Mailbox; thread: Thread; toAddress: string;
  footerText: string; canSend: boolean; canDraft: boolean; onSent: () => void; onDrafted: () => void;
}) {
  const reSubject = thread.subject.toLowerCase().startsWith("re:") ? thread.subject : `Re: ${thread.subject}`;
  const [body, setBody] = useState("");
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const [busy, setBusy] = useState<"send" | "draft" | null>(null);
  const [error, setError] = useState("");
  const committed = useRef(false);

  useEffect(() => { if (open) { setBody(""); setError(""); setAttachments([]); setToken(makeComposeToken()); setResetKey((k) => k + 1); committed.current = false; } }, [open]);

  const isEmpty = !stripTags(body).trim() && attachments.length === 0;

  // Closing without a send/save discards the staged uploads.
  const handleClose = () => { if (!committed.current) discardCompose(token); onClose(); };

  const send = async () => {
    setBusy("send"); setError("");
    const res = await fetch(`/api/admin-email/threads/${thread.id}/reply`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body_html: body, compose_token: token }),
    });
    setBusy(null);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not send"); return; }
    committed.current = true;
    onSent();
  };

  const saveDraft = async () => {
    setBusy("draft"); setError("");
    const res = await fetch("/api/admin-email/drafts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "reply", mailbox_id: mailbox.id, thread_id: thread.id, from_address: mailbox.address, to_address: toAddress, subject: reSubject, body_html: body, compose_token: token }),
    });
    setBusy(null);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not save draft"); return; }
    committed.current = true;
    onDrafted();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Reply className="h-5 w-5 text-secondary" /> Reply to this mail</DialogTitle>
          <DialogDescription>Your reply is sent from this mailbox; the customer&apos;s reply comes back to the same inbox.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 py-1 pr-1">
          <Input label="From" value={`${mailbox.display_name} <${mailbox.address}>`} readOnly disabled />
          <Input label="To" value={toAddress} readOnly disabled />
          <Input label="Subject" value={reSubject} readOnly disabled />
          <div>
            <label className="block text-sm font-medium text-charcoal-light mb-1.5">Message</label>
            <EmailEditor value={body} onChange={setBody} resetKey={resetKey} composeToken={token} placeholder="Type your reply…" />
          </div>
          {token && <AttachmentUploader composeToken={token} attachments={attachments} onChange={setAttachments} />}
          <FooterPreview footerText={footerText} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <AdminButton variant="outline" onClick={handleClose}>Cancel</AdminButton>
          {canDraft && (
            <AdminButton variant="outline" onClick={saveDraft} disabled={busy !== null || isEmpty}>
              {busy === "draft" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />} Save as Draft
            </AdminButton>
          )}
          {canSend && (
            <AdminButton onClick={send} disabled={busy !== null || isEmpty}>
              {busy === "send" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />} Send
            </AdminButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Quick check for "is the editor empty" — the editor can emit "<p></p>".
function stripTags(html: string): string {
  return (html || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim();
}

// ─── Drafts list (middle column) ───
function DraftsList({ drafts, mailboxes, canSend, onEdit, onChanged }: {
  drafts: Draft[]; mailboxes: Mailbox[]; canSend: boolean; onEdit: (d: Draft) => void; onChanged: () => void;
}) {
  const [sendingId, setSendingId] = useState<string | null>(null);
  const mbName = (id: string | null) => mailboxes.find((m) => m.id === id)?.address || "—";

  const send = async (d: Draft) => {
    if (!confirm(d.kind === "broadcast" ? "Send this broadcast draft now?" : `Send this reply to ${d.to_address}?`)) return;
    setSendingId(d.id);
    const res = await fetch(`/api/admin-email/drafts/${d.id}/send`, { method: "POST" });
    setSendingId(null);
    const r = await res.json().catch(() => ({}));
    if (!res.ok) { alert(r.error || "Could not send draft"); return; }
    if (d.kind === "broadcast") alert(`Broadcast sent to ${r.sent}/${r.recipient_count}${r.failed ? ` (${r.failed} failed)` : ""}.`);
    onChanged();
  };

  const remove = async (d: Draft) => {
    if (!confirm("Delete this draft?")) return;
    await fetch(`/api/admin-email/drafts/${d.id}`, { method: "DELETE" });
    onChanged();
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
      <div className="border-b border-border/30 px-3 py-2 text-xs font-medium text-charcoal-lighter">{drafts.length} draft{drafts.length === 1 ? "" : "s"}</div>
      <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/20">
        {drafts.length === 0 && <p className="p-6 text-center text-sm text-charcoal-lighter">No saved drafts.</p>}
        {drafts.map((d) => (
          <div key={d.id} className="px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-charcoal">
                {d.kind === "broadcast" ? <Megaphone className="h-3 w-3 text-amber-600" /> : <Reply className="h-3 w-3 text-secondary" />}
                {d.kind === "broadcast" ? "Broadcast" : "Reply"}
              </span>
              <span className="text-[10px] text-charcoal-lighter tabular-nums">{fmtTime(d.updated_at)}</span>
            </div>
            <p className="mt-0.5 truncate text-sm text-charcoal">{d.subject}</p>
            <p className="truncate text-[11px] text-charcoal-lighter">
              {mbName(d.mailbox_id)}{d.kind === "reply" ? ` → ${d.to_address || "—"}` : d.segment?.type ? ` · ${d.segment.type}` : ""}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <button onClick={() => onEdit(d)} className="text-[11px] text-secondary hover:underline">Edit</button>
              {canSend && <button onClick={() => send(d)} disabled={sendingId === d.id} className="text-[11px] text-secondary hover:underline">{sendingId === d.id ? "Sending…" : "Send"}</button>}
              <button onClick={() => remove(d)} className="text-[11px] text-destructive hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Draft editor modal (edit a saved reply/broadcast draft) ───
function DraftEditorModal({ draft, mailboxes, footerText, canSend, onClose, onChanged }: {
  draft: Draft; mailboxes: Mailbox[]; footerText: string; canSend: boolean; onClose: () => void; onChanged: () => void;
}) {
  const [subject, setSubject] = useState(draft.subject);
  const [to, setTo] = useState(draft.to_address || "");
  const [body, setBody] = useState(draft.body_text || "");
  const [busy, setBusy] = useState<"save" | "send" | null>(null);
  const [error, setError] = useState("");
  const [token] = useState(() => makeComposeToken());
  const committed = useRef(false);
  const mailbox = mailboxes.find((m) => m.id === draft.mailbox_id);

  const isEmpty = !stripTags(body).trim();
  const handleClose = () => { if (!committed.current) discardCompose(token); onClose(); };

  const save = async () => {
    setBusy("save"); setError("");
    const res = await fetch(`/api/admin-email/drafts/${draft.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, to_address: to, body_html: body, compose_token: token }),
    });
    setBusy(null);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not save"); return; }
    committed.current = true;
    onChanged();
  };

  const send = async () => {
    setBusy("send"); setError("");
    // Persist edits (and link inline images) first, then send.
    await fetch(`/api/admin-email/drafts/${draft.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, to_address: to, body_html: body, compose_token: token }),
    });
    const res = await fetch(`/api/admin-email/drafts/${draft.id}/send`, { method: "POST" });
    setBusy(null);
    const r = await res.json().catch(() => ({}));
    if (!res.ok) { setError(r.error || "Could not send"); return; }
    committed.current = true;
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-secondary" /> {draft.kind === "broadcast" ? "Broadcast draft" : "Reply draft"}</DialogTitle>
          <DialogDescription>Edit and save, or send it now. Attachments saved with this draft are kept.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 py-1 pr-1">
          <Input label="From" value={mailbox ? `${mailbox.display_name} <${mailbox.address}>` : "—"} readOnly disabled />
          {draft.kind === "reply" && <Input label="To" value={to} onChange={(e) => setTo(e.target.value)} />}
          {draft.kind === "broadcast" && draft.segment?.type && <Input label="Segment" value={draft.segment.type + (draft.segment.value ? ` ≥ ${draft.segment.value}` : "")} readOnly disabled />}
          <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-charcoal-light mb-1.5">Message</label>
            <EmailEditor value={body} onChange={setBody} composeToken={token} />
          </div>
          <FooterPreview footerText={footerText} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <AdminButton variant="outline" onClick={handleClose}>Cancel</AdminButton>
          <AdminButton variant="outline" onClick={save} disabled={busy !== null || isEmpty}>
            {busy === "save" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />} Save
          </AdminButton>
          {canSend && (
            <AdminButton onClick={send} disabled={busy !== null || isEmpty}>
              {busy === "send" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />} Send now
            </AdminButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mailbox configuration dialog (superadmin) ───
function MailboxDialog({ open, onClose, mailboxes, onChanged }: { open: boolean; onClose: () => void; mailboxes: Mailbox[]; onChanged: () => void }) {
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [canReceive, setCanReceive] = useState(true);
  const [canSendFlag, setCanSendFlag] = useState(true);
  const [canBroadcast, setCanBroadcast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const add = async () => {
    setSaving(true); setError("");
    const res = await fetch("/api/admin-email/mailboxes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, display_name: name, can_receive: canReceive, can_send: canSendFlag, can_broadcast: canBroadcast }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not add mailbox"); return; }
    setAddress(""); setName(""); setCanReceive(true); setCanSendFlag(true); setCanBroadcast(false);
    onChanged();
  };

  const toggle = async (m: Mailbox, field: "is_active" | "can_receive" | "can_send" | "can_broadcast") => {
    await fetch(`/api/admin-email/mailboxes/${m.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: !m[field] }) });
    onChanged();
  };

  const remove = async (m: Mailbox) => {
    if (!confirm(`Delete mailbox ${m.address}? All its threads and messages will be removed.`)) return;
    await fetch(`/api/admin-email/mailboxes/${m.id}`, { method: "DELETE" });
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-secondary" /> Mailboxes</DialogTitle>
          <DialogDescription>Configure receiving addresses. Mail to an address not listed here is dropped.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-1 pr-1">
          {mailboxes.map((m) => (
            <div key={m.id} className="rounded-lg border border-border/40 p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-charcoal">{m.display_name}</p>
                  <p className="truncate text-xs text-charcoal-lighter">{m.address}</p>
                </div>
                <button onClick={() => remove(m)} className="text-charcoal-lighter hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <FlagRow label="Active" on={m.is_active} onToggle={() => toggle(m, "is_active")} />
                <FlagRow label="Receive" on={m.can_receive} onToggle={() => toggle(m, "can_receive")} />
                <FlagRow label="Send/Reply" on={m.can_send} onToggle={() => toggle(m, "can_send")} />
                <FlagRow label="Broadcast" on={m.can_broadcast} onToggle={() => toggle(m, "can_broadcast")} />
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-dashed border-border/60 p-3 space-y-2">
            <p className="text-sm font-medium text-charcoal flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add mailbox</p>
            <Input label="Email address" placeholder="support@chinexabd.com" value={address} onChange={(e) => setAddress(e.target.value)} />
            <Input label="Display name" placeholder="ChineXa Support" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs pt-1">
              <FlagRow label="Receive" on={canReceive} onToggle={() => setCanReceive((v) => !v)} />
              <FlagRow label="Send/Reply" on={canSendFlag} onToggle={() => setCanSendFlag((v) => !v)} />
              <FlagRow label="Broadcast" on={canBroadcast} onToggle={() => setCanBroadcast((v) => !v)} />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end">
              <AdminButton size="sm" onClick={add} disabled={saving || !address || !name}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />} Add
              </AdminButton>
            </div>
          </div>
        </div>
        <DialogFooter><AdminButton variant="outline" onClick={onClose}>Done</AdminButton></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FlagRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-charcoal-lighter">{label}</span>
      <Switch checked={on} onCheckedChange={onToggle} />
    </div>
  );
}

// ─── Broadcast dialog (with save-as-draft) ───
function BroadcastDialog({ open, onClose, mailboxes, footerText, canDraft, onDrafted }: {
  open: boolean; onClose: () => void; mailboxes: Mailbox[]; footerText: string; canDraft: boolean; onDrafted: () => void;
}) {
  const [mailboxId, setMailboxId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const [segType, setSegType] = useState<"all" | "registered" | "min_spent">("all");
  const [minSpent, setMinSpent] = useState("");
  const [busy, setBusy] = useState<"send" | "draft" | null>(null);
  const [result, setResult] = useState("");
  // The set of tokens already committed (sent/drafted) this session, so closing
  // never discards uploads that were actually used.
  const committedTokens = useRef<Set<string>>(new Set());

  useEffect(() => { if (open && mailboxes.length && !mailboxId) setMailboxId(mailboxes[0].id); }, [open, mailboxes, mailboxId]);
  useEffect(() => { if (open && !token) setToken(makeComposeToken()); }, [open, token]);

  const segment = () => segType === "min_spent" ? { type: "min_spent", value: Number(minSpent) || 0 } : { type: segType };
  const bodyEmpty = !stripTags(body).trim();
  const resetCompose = () => { setSubject(""); setBody(""); setAttachments([]); setToken(makeComposeToken()); setResetKey((k) => k + 1); };

  const handleClose = () => { if (token && !committedTokens.current.has(token)) discardCompose(token); onClose(); };

  const send = async () => {
    setBusy("send"); setResult("");
    const res = await fetch("/api/admin-email/broadcast", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mailbox_id: mailboxId, subject, body_html: body, compose_token: token, segment: segment() }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setResult(d.error || "Broadcast failed"); return; }
    committedTokens.current.add(token);
    setResult(`Sent to ${d.sent}/${d.recipient_count} recipients${d.failed ? ` (${d.failed} failed)` : ""}.`);
    resetCompose();
  };

  const saveDraft = async () => {
    setBusy("draft"); setResult("");
    const res = await fetch("/api/admin-email/drafts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "broadcast", mailbox_id: mailboxId, subject, body_html: body, compose_token: token, segment: segment() }),
    });
    setBusy(null);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setResult(d.error || "Could not save draft"); return; }
    committedTokens.current.add(token);
    setResult("Saved to Drafts.");
    resetCompose();
    onDrafted();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-secondary" /> Broadcast email</DialogTitle>
          <DialogDescription>Send a one-way email to a customer segment. Recipients don&apos;t see each other.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 py-1 pr-1">
          {mailboxes.length === 0 ? (
            <p className="text-sm text-charcoal-lighter">No broadcast-enabled mailbox. Enable &quot;Broadcast&quot; on a mailbox first (Mailboxes → toggle).</p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-1.5">Send from</label>
                <Select value={mailboxId} onValueChange={setMailboxId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{mailboxes.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name} ({m.address})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-1.5">Recipients</label>
                <Select value={segType} onValueChange={(v) => setSegType(v as typeof segType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All customers</SelectItem>
                    <SelectItem value="registered">Registered accounts only</SelectItem>
                    <SelectItem value="min_spent">Spent at least…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {segType === "min_spent" && <Input label="Minimum total spent (৳)" type="number" value={minSpent} onChange={(e) => setMinSpent(e.target.value)} />}
              <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-1.5">Message</label>
                <EmailEditor value={body} onChange={setBody} resetKey={resetKey} composeToken={token} placeholder="Write your promotion…" />
              </div>
              {token && <AttachmentUploader composeToken={token} attachments={attachments} onChange={setAttachments} />}
              <FooterPreview footerText={footerText} />
              {result && <p className="text-xs text-secondary flex items-center gap-1"><Check className="h-3 w-3" /> {result}</p>}
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <AdminButton variant="outline" onClick={handleClose}>Close</AdminButton>
          {mailboxes.length > 0 && canDraft && (
            <AdminButton variant="outline" onClick={saveDraft} disabled={busy !== null || !subject.trim() || bodyEmpty || !mailboxId}>
              {busy === "draft" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />} Save as Draft
            </AdminButton>
          )}
          {mailboxes.length > 0 && (
            <AdminButton onClick={send} disabled={busy !== null || !subject.trim() || bodyEmpty || !mailboxId}>
              {busy === "send" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />} Send broadcast
            </AdminButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Multi-recipient chip input (To / CC / BCC) ───
function RecipientInput({ label, value, onChange, placeholder }: {
  label: string; value: string[]; onChange: (next: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const commit = () => {
    const parts = draft.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (parts.length) onChange(Array.from(new Set([...value, ...parts])));
    setDraft("");
  };
  return (
    <div>
      <label className="block text-sm font-medium text-charcoal-light mb-1.5">{label}</label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 min-h-[40px]">
        {value.map((email) => (
          <span key={email} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", EMAIL_RE.test(email) ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive")}>
            {email}
            <button type="button" onClick={() => onChange(value.filter((e) => e !== email))} className="hover:opacity-70"><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === "," || e.key === ";") { e.preventDefault(); commit(); } else if (e.key === "Backspace" && !draft && value.length) { onChange(value.slice(0, -1)); } }}
          onBlur={commit}
          onPaste={(e) => { const t = e.clipboardData.getData("text"); if (/[,;\s]/.test(t)) { e.preventDefault(); setDraft((d) => d + t); setTimeout(commit, 0); } }}
          placeholder={value.length === 0 ? (placeholder || "name@example.com") : ""}
          className="flex-1 min-w-[140px] bg-transparent text-sm outline-none py-0.5 placeholder:text-charcoal-lighter/50"
        />
      </div>
    </div>
  );
}

// ─── Compose a 1-to-1 / official email (multi-recipient, CC/BCC) ───
function ComposeDialog({ open, onClose, mailboxes, footerText, onSent }: {
  open: boolean; onClose: () => void; mailboxes: Mailbox[]; footerText: string; onSent: () => void;
}) {
  const sendable = mailboxes.filter((m) => m.can_send);
  const [mailboxId, setMailboxId] = useState("");
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const committedTokens = useRef<Set<string>>(new Set());

  useEffect(() => { if (open && sendable.length && !mailboxId) setMailboxId(sendable[0].id); }, [open, sendable, mailboxId]);
  useEffect(() => { if (open && !token) setToken(makeComposeToken()); }, [open, token]);

  const bodyEmpty = !stripTags(body).trim();
  const resetCompose = () => { setSubject(""); setBody(""); setTo([]); setCc([]); setBcc([]); setAttachments([]); setToken(makeComposeToken()); setResetKey((k) => k + 1); };
  const handleClose = () => { if (token && !committedTokens.current.has(token)) discardCompose(token); onClose(); };

  const send = async () => {
    setBusy(true); setResult(""); setError("");
    const res = await fetch("/api/admin-email/compose", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mailbox_id: mailboxId, to, cc, bcc, subject, body_html: body, compose_token: token }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d.error || "Send failed"); return; }
    committedTokens.current.add(token);
    setResult(`Sent to ${d.sent} recipient${d.sent !== 1 ? "s" : ""}${d.failed ? ` (${d.failed} failed)` : ""}.`);
    resetCompose();
    onSent();
  };

  const canSend = !busy && !!mailboxId && to.length > 0 && !!subject.trim() && !bodyEmpty;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-secondary" /> New email</DialogTitle>
          <DialogDescription>Send a 1-to-1 or official email. It opens a thread in the inbox so replies come back here.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 py-1 pr-1">
          {sendable.length === 0 ? (
            <p className="text-sm text-charcoal-lighter">You don&apos;t have a send-enabled mailbox. Ask a superadmin to grant you a mailbox with sending enabled.</p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-1.5">Send from</label>
                <Select value={mailboxId} onValueChange={setMailboxId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{sendable.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name} ({m.address})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <RecipientInput label="To" value={to} onChange={setTo} placeholder="Enter recipient emails…" />
              {!showCcBcc ? (
                <button type="button" onClick={() => setShowCcBcc(true)} className="text-xs text-secondary hover:underline">+ Add CC / BCC</button>
              ) : (
                <>
                  <RecipientInput label="CC" value={cc} onChange={setCc} />
                  <RecipientInput label="BCC" value={bcc} onChange={setBcc} />
                </>
              )}
              <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-1.5">Message</label>
                <EmailEditor value={body} onChange={setBody} resetKey={resetKey} composeToken={token} placeholder="Write your email…" />
              </div>
              {token && <AttachmentUploader composeToken={token} attachments={attachments} onChange={setAttachments} />}
              <FooterPreview footerText={footerText} />
              {result && <p className="text-xs text-secondary flex items-center gap-1"><Check className="h-3 w-3" /> {result}</p>}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <AdminButton variant="outline" onClick={handleClose}>Close</AdminButton>
          {sendable.length > 0 && (
            <AdminButton onClick={send} disabled={!canSend}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />} Send
            </AdminButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
