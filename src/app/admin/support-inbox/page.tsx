"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, Send, Loader2, LifeBuoy, Search, User, Trash2, AlertTriangle, Check, CheckCheck, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { resolveTierColorStyle } from "@/lib/tier-color";
import { useAdmin } from "@/contexts/admin-context";

type SortKey = "time" | "tier";

// Fallback colors for tier names that don't (yet) carry their own `color`
// from /api/membership/tiers — same map used on the customers page, so tier
// badges look consistent across admin. "Guest" is a pseudo-tier (no
// customer_id) that stands in place of a real membership tier in this filter.
const fallbackTierColors: Record<string, string> = {
  Guest: "bg-charcoal/10 text-charcoal-lighter",
  Bronze: "bg-orange-100 text-orange-700",
  Silver: "bg-gray-100 text-gray-600",
  Gold: "bg-amber-50 text-amber-700",
  Platinum: "bg-violet-50 text-violet-700",
};

const ACTIVE_POLL_MS = 3000; // a conversation is open in the thread view
const LIST_POLL_MS = 20000; // conversation list, background refresh

/** True while the tab is in the foreground — pause polling otherwise. */
function useIsPageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

interface Conversation {
  id: string;
  customer_id: string | null;
  guest_id: string | null;
  display_name: string;
  status: "open" | "closed";
  customer_unread: number;
  admin_unread: number;
  last_message_at: string;
  created_at: string;
  phone: string | null;
  avatar: string | null;
  tier: string;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_type: "customer" | "admin";
  flag: "general" | "help_and_support";
  body: string;
  is_read: boolean;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function timeLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(dateStr));
}

export default function SupportInboxPage() {
  const { can } = useAdmin();
  const canReply = can("support_inbox", "add");
  const canDelete = can("support_inbox", "delete");
  const pageVisible = useIsPageVisible();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [tierColorMap, setTierColorMap] = useState<Record<string, string>>({});
  const [tierOrder, setTierOrder] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations?admin=1");
      const data = await res.json();
      if (Array.isArray(data)) setConversations(data);
    } catch {} finally { setLoadingList(false); }
  }, []);

  useEffect(() => {
    if (!pageVisible) return;
    fetchConversations();
    const interval = setInterval(fetchConversations, LIST_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchConversations, pageVisible]);

  // Real configured membership tiers, for the filter dropdown + badge colors.
  // "Guest" is appended after — it's not a real tier row, just the label the
  // API assigns to conversations with no customer_id.
  useEffect(() => {
    fetch("/api/membership/tiers")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTierOrder([...data.map((t: { name: string }) => t.name), "Guest"]);
          setTierColorMap(Object.fromEntries(data.map((t: { name: string; color?: string }) => [t.name, t.color || ""])));
        }
      })
      .catch(() => {});
  }, []);

  const markRead = useCallback((conversationId: string) => {
    fetch("/api/chat/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId, reader: "admin" }),
    }).catch(() => {});
  }, []);

  // Initial full load whenever a different conversation is selected.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoadingMessages(true);
    fetch(`/api/chat/messages?conversation_id=${activeId}&admin=1`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) setMessages(data);
        markRead(activeId);
        setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, admin_unread: 0 } : c)));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingMessages(false); });
    return () => { cancelled = true; };
  }, [activeId, markRead]);

  // Delta polling — only the messages newer than the last one shown, and only
  // while the tab is focused. Avoids re-downloading the whole thread every tick.
  useEffect(() => {
    if (!activeId || !pageVisible) return;
    const interval = setInterval(async () => {
      const lastId = messagesRef.current[messagesRef.current.length - 1]?.id;
      try {
        const res = await fetch(
          `/api/chat/messages?conversation_id=${activeId}&admin=1&viewer=admin${lastId ? `&after_id=${lastId}` : ""}`
        );
        const data = await res.json();
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages((prev) => [...prev, ...data.messages]);
          markRead(activeId);
        }
        // Patch in a "Seen" flip on the admin's own last reply without a full
        // reload — same reasoning as the customer widget's poll.
        if (data.lastOwnMessageReadState) {
          const { id, is_read } = data.lastOwnMessageReadState;
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_read } : m)));
        }
      } catch {}
    }, ACTIVE_POLL_MS);
    return () => clearInterval(interval);
  }, [activeId, pageVisible, markRead]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!draft.trim() || sending || !activeId) return;
    setSending(true);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: activeId, sender_type: "admin", message: draft.trim() }),
      });
      const sent = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, sent]);
        setDraft("");
        fetchConversations();
      }
    } catch {} finally { setSending(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/chat/conversations?id=${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        if (activeId === deleteTarget.id) { setActiveId(null); setMessages([]); }
      }
    } catch {} finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const filtered = conversations
    .filter((c) => c.display_name.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => tierFilter === "all" || c.tier === tierFilter)
    .slice()
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "time") {
        cmp = new Date(a.last_message_at).getTime() - new Date(b.last_message_at).getTime();
      } else {
        // Rank by configured tier order (Guest last), not alphabetically —
        // tierOrder already ends with "Guest" so an unknown tier falls back after it.
        const rank = (t: string) => { const i = tierOrder.indexOf(t); return i === -1 ? tierOrder.length : i; };
        cmp = rank(a.tier) - rank(b.tier);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  const active = conversations.find((c) => c.id === activeId) || null;
  const lastAdminMessageId = [...messages].reverse().find((m) => m.sender_type === "admin")?.id;

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir(key === "time" ? "desc" : "asc"); }
  };

  const TierBadge = ({ tier }: { tier: string }) => {
    const tierColor = resolveTierColorStyle(tierColorMap[tier] || fallbackTierColors[tier]);
    return (
      <span
        className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wide", tierColor.className)}
        style={tierColor.style}
      >
        {tier}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-charcoal flex items-center gap-2">
          <LifeBuoy className="h-6 w-6 text-secondary" /> Support Inbox
        </h1>
        <p className="text-sm text-charcoal-lighter mt-1">Chat with customers and guests visiting the store.</p>
      </div>

      <div className="flex h-[calc(100vh-220px)] min-h-[500px] rounded-luxury border border-border/30 bg-white shadow-card overflow-hidden">
        {/* Conversation list */}
        <div className={cn("w-full sm:w-80 shrink-0 border-r border-border/20 flex flex-col", activeId && "hidden sm:flex")}>
          <div className="p-3 border-b border-border/20 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-charcoal-lighter" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-full border border-border/30 bg-pearl/40 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              />
            </div>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All tiers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tiers</SelectItem>
                {tierOrder.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-charcoal-lighter shrink-0">Sort by</span>
              <button
                type="button"
                onClick={() => toggleSort("time")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors active:scale-[0.96]",
                  sortBy === "time" ? "bg-secondary/10 text-secondary" : "text-charcoal-lighter hover:bg-pearl"
                )}
              >
                Time <ArrowUpDown className={cn("h-2.5 w-2.5", sortBy === "time" && "text-secondary")} />
              </button>
              <button
                type="button"
                onClick={() => toggleSort("tier")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors active:scale-[0.96]",
                  sortBy === "tier" ? "bg-secondary/10 text-secondary" : "text-charcoal-lighter hover:bg-pearl"
                )}
              >
                Tier <ArrowUpDown className={cn("h-2.5 w-2.5", sortBy === "tier" && "text-secondary")} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="flex items-center justify-center py-10 text-charcoal-lighter">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 px-4">
                <MessageCircle className="h-8 w-8 text-charcoal-lighter/30 mx-auto mb-2" />
                <p className="text-xs text-charcoal-lighter">No conversations yet.</p>
              </div>
            ) : (
              filtered.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "group w-full flex items-center gap-3 px-4 py-3 border-b border-l-2 border-l-transparent border-border/10 hover:bg-pearl/50 transition-colors",
                    activeId === c.id && "bg-primary-light/50 border-l-secondary"
                  )}
                >
                  <button onClick={() => setActiveId(c.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary overflow-hidden">
                      {c.avatar ? <img src={c.avatar} alt={c.display_name} className="h-full w-full object-cover" /> : <User className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("text-sm truncate", c.admin_unread > 0 ? "font-semibold text-charcoal" : "text-charcoal")}>{c.display_name}</p>
                        <span className="text-[9px] text-charcoal-lighter shrink-0">{timeAgo(c.last_message_at)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <p className="text-[11px] text-charcoal-lighter truncate">{c.phone || (c.customer_id ? "Registered customer" : "Guest")}</p>
                          <TierBadge tier={c.tier} />
                        </span>
                        {c.admin_unread > 0 && (
                          <span className="text-[9px] font-bold bg-secondary text-white px-1.5 py-0.5 rounded-full shrink-0">{c.admin_unread}</span>
                        )}
                      </div>
                    </div>
                  </button>
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                      className="shrink-0 rounded-full p-1.5 text-charcoal-lighter opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all active:scale-[0.96]"
                      aria-label={`Delete conversation with ${c.display_name}`}
                      title="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        <div className={cn("flex-1 flex flex-col min-w-0", !activeId && "hidden sm:flex")}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-charcoal-lighter">
              <MessageCircle className="h-10 w-10 text-charcoal-lighter/30 mb-3" />
              <p className="text-sm">Select a conversation to start replying.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20">
                <button onClick={() => setActiveId(null)} className="sm:hidden text-xs text-secondary">← Back</button>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/10 text-secondary overflow-hidden">
                  {active.avatar ? <img src={active.avatar} alt={active.display_name} className="h-full w-full object-cover" /> : <User className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-charcoal">{active.display_name}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] text-charcoal-lighter">{active.phone || (active.customer_id ? "Registered customer" : "Guest visitor")}</p>
                    <TierBadge tier={active.tier} />
                  </div>
                </div>
                {canDelete && (
                  <button
                    onClick={() => setDeleteTarget(active)}
                    className="shrink-0 rounded-full p-2 text-charcoal-lighter hover:bg-destructive/10 hover:text-destructive transition-colors active:scale-[0.96]"
                    aria-label="Delete conversation"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain bg-pearl/30 px-4 py-4 space-y-2">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-10 text-charcoal-lighter">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-charcoal-lighter py-10">No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={cn("flex", m.sender_type === "admin" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                          m.sender_type === "admin"
                            ? "bg-secondary text-white rounded-br-sm"
                            : "bg-white text-charcoal border border-border/20 rounded-bl-sm"
                        )}
                      >
                        {m.flag === "help_and_support" && m.sender_type === "customer" && (
                          <span className="block text-[9px] font-semibold uppercase tracking-wide text-secondary mb-0.5">Help & Support</span>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <div className={cn("flex items-center gap-1 mt-1", m.sender_type === "admin" ? "text-white/60 justify-end" : "text-charcoal-lighter")}>
                          <span className="text-[9px]">{timeLabel(m.created_at)}</span>
                          {m.sender_type === "admin" && m.id === lastAdminMessageId && (
                            m.is_read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="shrink-0 flex items-end gap-2 border-t border-border/20 p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Type a reply..."
                  rows={1}
                  maxLength={5000}
                  className="flex-1 resize-none rounded-lg border border-border/30 bg-pearl/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 max-h-28"
                />
                {canReply && (
                  <button
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary !text-white transition-all hover:bg-secondary-dark disabled:opacity-40 active:scale-[0.96] disabled:active:scale-100"
                    aria-label="Send reply"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation — permanent, no undo (messages cascade-delete with the conversation) */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete Conversation
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the entire conversation with <strong>{deleteTarget?.display_name}</strong> and all its messages from the database. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </AdminButton>
            {canDelete && (
              <AdminButton variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                {deleting ? "Deleting..." : "Delete Permanently"}
              </AdminButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
