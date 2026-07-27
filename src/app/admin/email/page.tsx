"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail, Send, Loader2, Inbox, ArrowDownLeft, ArrowUpRight, Plus, Trash2,
  Megaphone, Settings2, RefreshCw, X, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { useAdmin } from "@/contexts/admin-context";

interface Mailbox {
  id: string; address: string; display_name: string;
  is_active: boolean; can_receive: boolean; can_send: boolean; can_broadcast: boolean;
}
interface Thread {
  id: string; mailbox_id: string; correspondent: string; correspondent_name: string | null;
  subject: string; status: "open" | "closed"; admin_unread: number; message_count: number; last_message_at: string;
}
interface Message {
  id: string; direction: "inbound" | "outbound"; from_address: string; to_address: string;
  subject: string; body_html: string | null; body_text: string | null; created_at: string;
}
interface Counts { sent: number; received: number; broadcast: number; total: number; unread: number }

const fmtTime = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function EmailCenterPage() {
  const { can, role } = useAdmin();
  const isSuper = role === "superadmin" || role === "system_admin";
  const canSend = can("email_inbox", "add");
  const canDelete = can("email_inbox", "delete");

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string>(""); // "" = all
  const [threads, setThreads] = useState<Thread[]>([]);
  const [counts, setCounts] = useState<Counts>({ sent: 0, received: 0, broadcast: 0, total: 0, unread: 0 });
  const [totals, setTotals] = useState<Counts>({ sent: 0, received: 0, broadcast: 0, total: 0, unread: 0 });
  const [loading, setLoading] = useState(true);

  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadMailbox, setThreadMailbox] = useState<Mailbox | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const [mailboxDialog, setMailboxDialog] = useState(false);
  const [broadcastDialog, setBroadcastDialog] = useState(false);

  const load = useCallback(async () => {
    const url = `/api/admin-email${selectedMailbox ? `?mailbox_id=${selectedMailbox}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setMailboxes(data.mailboxes || []);
    setThreads(data.threads || []);
    setCounts(data.counts);
    setTotals(data.totals);
    setLoading(false);
  }, [selectedMailbox]);

  useEffect(() => { load(); }, [load]);

  const openThread = async (t: Thread) => {
    setActiveThread(t);
    setMessages([]);
    setReply("");
    const res = await fetch(`/api/admin-email/threads/${t.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages || []);
    setThreadMailbox(data.mailbox || null);
    // Clear the unread badge locally.
    setThreads((prev) => prev.map((x) => (x.id === t.id ? { ...x, admin_unread: 0 } : x)));
  };

  const sendReply = async () => {
    if (!activeThread || !reply.trim()) return;
    setSending(true);
    const res = await fetch(`/api/admin-email/threads/${activeThread.id}/reply`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply.trim() }),
    });
    setSending(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Could not send reply");
      return;
    }
    setReply("");
    await openThread(activeThread);
    load();
  };

  const deleteThread = async (t: Thread) => {
    if (!confirm(`Delete this email thread with ${t.correspondent}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin-email/threads/${t.id}`, { method: "DELETE" });
    if (res.ok) {
      setThreads((prev) => prev.filter((x) => x.id !== t.id));
      if (activeThread?.id === t.id) setActiveThread(null);
      load();
    }
  };

  const StatCard = ({ icon: Icon, label, value, tone }: { icon: typeof Mail; label: string; value: number; tone: string }) => (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", tone)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-semibold leading-none text-charcoal tabular-nums">{value.toLocaleString()}</p>
        <p className="text-[11px] text-charcoal-lighter mt-1">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header + counts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-charcoal flex items-center gap-2"><Mail className="h-5 w-5 text-secondary" /> Email Center</h1>
          <p className="text-sm text-charcoal-lighter">Receive, reply to, and broadcast email across your mailboxes.</p>
        </div>
        <div className="flex items-center gap-2">
          <AdminButton variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh</AdminButton>
          {canSend && (
            <AdminButton variant="outline" size="sm" onClick={() => setBroadcastDialog(true)}><Megaphone className="h-3.5 w-3.5 mr-1" /> Broadcast</AdminButton>
          )}
          {isSuper && (
            <AdminButton size="sm" onClick={() => setMailboxDialog(true)}><Settings2 className="h-3.5 w-3.5 mr-1" /> Mailboxes</AdminButton>
          )}
        </div>
      </div>

      {/* Always-visible counters: Sent / Received / Total (store-wide). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={ArrowUpRight} label="Sent" value={totals.sent} tone="bg-blue-50 text-blue-600" />
        <StatCard icon={ArrowDownLeft} label="Received" value={totals.received} tone="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Megaphone} label="Broadcast sent" value={totals.broadcast} tone="bg-amber-50 text-amber-600" />
        <StatCard icon={Inbox} label="Total emails" value={totals.total} tone="bg-secondary/10 text-secondary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_320px_1fr] gap-4">
        {/* Mailbox rail */}
        <div className="rounded-xl border border-border/40 bg-card p-2 h-fit">
          <button
            onClick={() => setSelectedMailbox("")}
            className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
              selectedMailbox === "" ? "bg-primary-light text-charcoal font-medium" : "text-charcoal-lighter hover:bg-pearl")}
          >
            <span className="flex items-center gap-2"><Inbox className="h-4 w-4" /> All mailboxes</span>
          </button>
          {mailboxes.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMailbox(m.id)}
              className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                selectedMailbox === m.id ? "bg-primary-light text-charcoal font-medium" : "text-charcoal-lighter hover:bg-pearl")}
              title={m.address}
            >
              <span className="truncate text-left">
                <span className="block truncate">{m.display_name}</span>
                <span className="block truncate text-[10px] text-charcoal-lighter">{m.address}</span>
              </span>
              {!m.is_active && <span className="text-[9px] text-charcoal-lighter">off</span>}
            </button>
          ))}
          {mailboxes.length === 0 && !loading && (
            <p className="px-3 py-4 text-center text-xs text-charcoal-lighter">
              No mailboxes yet.{isSuper && " Add one to start receiving."}
            </p>
          )}
        </div>

        {/* Thread list */}
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
          <div className="border-b border-border/30 px-3 py-2 text-xs font-medium text-charcoal-lighter flex items-center justify-between">
            <span>{threads.length} conversation{threads.length === 1 ? "" : "s"}</span>
            <span className="tabular-nums">{counts.unread > 0 ? `${counts.unread} unread` : ""}</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/20">
            {loading && <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-charcoal-lighter" /></div>}
            {!loading && threads.length === 0 && (
              <p className="p-6 text-center text-sm text-charcoal-lighter">No emails yet.</p>
            )}
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t)}
                className={cn("flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-pearl",
                  activeThread?.id === t.id && "bg-pearl")}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className={cn("truncate text-sm", t.admin_unread > 0 ? "font-semibold text-charcoal" : "text-charcoal")}>
                    {t.correspondent_name || t.correspondent}
                  </span>
                  <span className="shrink-0 text-[10px] text-charcoal-lighter">{fmtTime(t.last_message_at)}</span>
                </div>
                <span className="truncate text-xs text-charcoal-lighter w-full">{t.subject}</span>
                {t.admin_unread > 0 && <span className="mt-0.5 rounded-full bg-secondary/15 px-1.5 py-0.5 text-[9px] font-medium text-secondary">{t.admin_unread} new</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Thread view */}
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden flex flex-col min-h-[50vh]">
          {!activeThread ? (
            <div className="flex flex-1 items-center justify-center text-center p-8">
              <div>
                <Mail className="h-8 w-8 mx-auto text-charcoal-lighter/50" />
                <p className="mt-2 text-sm text-charcoal-lighter">Select a conversation to read it.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-border/30 px-4 py-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-charcoal">{activeThread.subject}</p>
                  <p className="truncate text-xs text-charcoal-lighter">
                    {activeThread.correspondent_name ? `${activeThread.correspondent_name} · ` : ""}{activeThread.correspondent}
                    {threadMailbox && <span> → {threadMailbox.address}</span>}
                  </p>
                </div>
                {canDelete && (
                  <button onClick={() => deleteThread(activeThread)} className="text-charcoal-lighter hover:text-destructive transition-colors" title="Delete thread">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
                {messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[80%] rounded-xl px-3 py-2 text-sm",
                      m.direction === "outbound" ? "bg-secondary/10 text-charcoal" : "bg-pearl text-charcoal")}>
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] text-charcoal-lighter">
                        {m.direction === "outbound" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                        <span>{m.direction === "outbound" ? "You" : m.from_address}</span>
                        <span>· {fmtTime(m.created_at)}</span>
                      </div>
                      <div className="whitespace-pre-wrap break-words">{m.body_text || stripHtml(m.body_html)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {canSend && threadMailbox?.can_send && (
                <div className="border-t border-border/30 p-3">
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply as ${threadMailbox.address}…`} rows={3} className="mb-2" />
                  <div className="flex justify-end">
                    <AdminButton size="sm" onClick={sendReply} disabled={sending || !reply.trim()}>
                      {sending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                      Send reply
                    </AdminButton>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isSuper && <MailboxDialog open={mailboxDialog} onClose={() => setMailboxDialog(false)} mailboxes={mailboxes} onChanged={load} />}
      {canSend && <BroadcastDialog open={broadcastDialog} onClose={() => setBroadcastDialog(false)} mailboxes={mailboxes.filter((m) => m.can_broadcast)} />}
    </div>
  );
}

function stripHtml(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
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
    await fetch(`/api/admin-email/mailboxes/${m.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !m[field] }),
    });
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

// ─── Broadcast (no-reply) dialog ───
function BroadcastDialog({ open, onClose, mailboxes }: { open: boolean; onClose: () => void; mailboxes: Mailbox[] }) {
  const [mailboxId, setMailboxId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [segType, setSegType] = useState<"all" | "registered" | "min_spent">("all");
  const [minSpent, setMinSpent] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string>("");

  useEffect(() => { if (open && mailboxes.length && !mailboxId) setMailboxId(mailboxes[0].id); }, [open, mailboxes, mailboxId]);

  const send = async () => {
    setSending(true); setResult("");
    const segment = segType === "min_spent" ? { type: "min_spent", value: Number(minSpent) || 0 } : { type: segType };
    const res = await fetch("/api/admin-email/broadcast", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mailbox_id: mailboxId, subject, body, segment }),
    });
    const d = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { setResult(d.error || "Broadcast failed"); return; }
    setResult(`Sent to ${d.sent}/${d.recipient_count} recipients${d.failed ? ` (${d.failed} failed)` : ""}.`);
    setSubject(""); setBody("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
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
                  <SelectContent>
                    {mailboxes.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name} ({m.address})</SelectItem>)}
                  </SelectContent>
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
              {segType === "min_spent" && (
                <Input label="Minimum total spent (৳)" type="number" value={minSpent} onChange={(e) => setMinSpent(e.target.value)} />
              )}
              <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <Textarea label="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
              {result && <p className="text-xs text-secondary flex items-center gap-1"><Check className="h-3 w-3" /> {result}</p>}
            </>
          )}
        </div>
        <DialogFooter>
          <AdminButton variant="outline" onClick={onClose}>Close</AdminButton>
          {mailboxes.length > 0 && (
            <AdminButton onClick={send} disabled={sending || !subject.trim() || !body.trim() || !mailboxId}>
              {sending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />} Send broadcast
            </AdminButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
