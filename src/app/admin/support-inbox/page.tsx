"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, Send, Loader2, LifeBuoy, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_type: "customer" | "admin";
  flag: "general" | "help_and_support";
  body: string;
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations?admin=1");
      const data = await res.json();
      if (Array.isArray(data)) setConversations(data);
    } catch {} finally { setLoadingList(false); }
  }, []);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 20000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/chat/messages?conversation_id=${conversationId}&admin=1`);
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch {} finally { setLoadingMessages(false); }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId);
    fetch("/api/chat/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: activeId, reader: "admin" }),
    }).catch(() => {});
    setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, admin_unread: 0 } : c)));

    const interval = setInterval(() => loadMessages(activeId), 8000);
    return () => clearInterval(interval);
  }, [activeId, loadMessages]);

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

  const filtered = conversations.filter((c) => c.display_name.toLowerCase().includes(search.toLowerCase()));
  const active = conversations.find((c) => c.id === activeId) || null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-charcoal flex items-center gap-2">
          <LifeBuoy className="h-6 w-6 text-secondary" /> Support Inbox
        </h1>
        <p className="text-sm text-charcoal-lighter mt-1">Chat with customers and guests visiting the store.</p>
      </div>

      <div className="flex h-[calc(100vh-220px)] min-h-[500px] rounded-2xl border border-border/30 bg-white overflow-hidden">
        {/* Conversation list */}
        <div className={cn("w-full sm:w-80 shrink-0 border-r border-border/20 flex flex-col", activeId && "hidden sm:flex")}>
          <div className="p-3 border-b border-border/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-charcoal-lighter" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-full border border-border/30 bg-pearl/40 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              />
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
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border/10 hover:bg-pearl/50 transition-colors",
                    activeId === c.id && "bg-primary-light/50"
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm truncate", c.admin_unread > 0 ? "font-semibold text-charcoal" : "text-charcoal")}>{c.display_name}</p>
                      <span className="text-[9px] text-charcoal-lighter shrink-0">{timeAgo(c.last_message_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-[11px] text-charcoal-lighter truncate">{c.customer_id ? "Registered customer" : "Guest"}</p>
                      {c.admin_unread > 0 && (
                        <span className="text-[9px] font-bold bg-secondary text-white px-1.5 py-0.5 rounded-full shrink-0">{c.admin_unread}</span>
                      )}
                    </div>
                  </div>
                </button>
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
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal">{active.display_name}</p>
                  <p className="text-[10px] text-charcoal-lighter">{active.customer_id ? "Registered customer" : "Guest visitor"}</p>
                </div>
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
                        <p className={cn("text-[9px] mt-1", m.sender_type === "admin" ? "text-white/60" : "text-charcoal-lighter")}>{timeLabel(m.created_at)}</p>
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
                  className="flex-1 resize-none rounded-xl border border-border/30 bg-pearl/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 max-h-28"
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-white transition-all hover:bg-secondary-dark disabled:opacity-40"
                  aria-label="Send reply"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
