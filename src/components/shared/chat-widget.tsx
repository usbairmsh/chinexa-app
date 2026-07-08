"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Loader2, LifeBuoy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/auth.store";
import { useChatStore } from "@/stores/chat.store";
import { getGuestId } from "@/lib/guest-id";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  sender_type: "customer" | "admin";
  flag: "general" | "help_and_support";
  body: string;
  created_at: string;
}

function timeLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(dateStr));
}

export function ChatWidget() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");
  const storeUser = useAuthStore((s) => s.user);
  const { open, pendingFlag, unread, openChat, closeChat, setUnread } = useChatStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const identity = mounted
    ? storeUser?.id
      ? { customerId: storeUser.id, displayName: storeUser.phone }
      : { guestId: getGuestId(), displayName: `guest${getGuestId().replace("guest", "")}` }
    : null;

  // Unread badge — poll every 45s and on route change, matching the header bell's cadence.
  const fetchUnread = useCallback(async () => {
    if (!identity) return;
    try {
      const params = identity.customerId
        ? `customer_id=${identity.customerId}`
        : `guest_id=${identity.guestId}`;
      const res = await fetch(`/api/chat/unread-count?${params}`);
      const data = await res.json();
      if (res.ok && Number.isFinite(Number(data?.unread))) setUnread(Number(data.unread));
    } catch {}
  }, [identity, setUnread]);

  useEffect(() => {
    if (isAdminRoute || !identity) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, 45000);
    return () => clearInterval(interval);
  }, [isAdminRoute, identity, pathname, fetchUnread]);

  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (!identity) return null;
    const params = new URLSearchParams({
      ...(identity.customerId ? { customer_id: identity.customerId } : { guest_id: identity.guestId! }),
      display_name: identity.displayName,
    });
    const res = await fetch(`/api/chat/conversations?${params.toString()}`);
    const data = await res.json();
    if (res.ok && data?.id) {
      setConversationId(data.id);
      return data.id;
    }
    return null;
  }, [identity]);

  const loadMessages = useCallback(async (convId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/messages?conversation_id=${convId}`);
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch {} finally { setLoading(false); }
  }, []);

  // Once open: get-or-create the conversation, load history, mark read, and
  // poll for new replies every 8s while the panel stays open.
  useEffect(() => {
    if (!open || !identity) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    (async () => {
      const convId = conversationId || (await ensureConversation());
      if (cancelled || !convId) return;
      await loadMessages(convId);
      fetch("/api/chat/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: convId, reader: "customer" }),
      }).catch(() => {});
      setUnread(0);
      interval = setInterval(() => loadMessages(convId), 8000);
    })();

    return () => { cancelled = true; if (interval) clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, identity]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const convId = conversationId || (await ensureConversation());
      if (!convId) return;
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: convId,
          sender_type: "customer",
          flag: pendingFlag,
          message: draft.trim(),
        }),
      });
      const sent = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, sent]);
        setDraft("");
      }
    } catch {} finally { setSending(false); }
  };

  if (!mounted || isAdminRoute) return null;

  return (
    <>
      {/* Floating launcher — bottom-left, always visible while browsing */}
      {!open && (
        <button
          onClick={() => openChat("general")}
          className="fixed bottom-4 left-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-white shadow-[0_8px_30px_rgba(0,0,0,0.2)] transition-transform hover:scale-105"
          aria-label={unread > 0 ? `Chat with support (${unread} unread)` : "Chat with support"}
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-coral text-[10px] font-bold text-white ring-2 ring-white"
            >
              {unread > 99 ? "99+" : unread}
            </motion.span>
          )}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:left-4 sm:bottom-4 sm:w-96 flex flex-col rounded-2xl border border-border/30 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.18)] overflow-hidden max-h-[80vh] sm:max-h-[560px]"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-4 py-3 bg-secondary text-white">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                  <LifeBuoy className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">ChineXa Support</p>
                  <p className="text-[10px] text-white/70 leading-tight">We usually reply within a few hours</p>
                </div>
              </div>
              <button onClick={closeChat} className="rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white transition-colors" aria-label="Close chat">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 min-h-[280px] overflow-y-auto overscroll-contain bg-pearl/40 px-3 py-3 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-charcoal-lighter">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <MessageCircle className="h-8 w-8 text-charcoal-lighter/30 mx-auto mb-2" />
                  <p className="text-xs text-charcoal-lighter">
                    {pendingFlag === "help_and_support" ? "Tell us what you need help with and we'll get back to you." : "Send us a message — we're happy to help!"}
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.sender_type === "customer" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        m.sender_type === "customer"
                          ? "bg-secondary text-white rounded-br-sm"
                          : "bg-white text-charcoal border border-border/20 rounded-bl-sm"
                      )}
                    >
                      {m.flag === "help_and_support" && m.sender_type === "customer" && (
                        <span className="block text-[9px] font-semibold uppercase tracking-wide text-white/70 mb-0.5">Help & Support</span>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={cn("text-[9px] mt-1", m.sender_type === "customer" ? "text-white/60" : "text-charcoal-lighter")}>{timeLabel(m.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Composer */}
            <div className="shrink-0 flex items-end gap-2 border-t border-border/20 bg-white p-2.5">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border/30 bg-pearl/50 px-3 py-2 text-sm text-charcoal placeholder:text-charcoal-lighter focus:outline-none focus:ring-2 focus:ring-secondary/30 max-h-24"
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-white transition-all hover:bg-secondary-dark disabled:opacity-40"
                aria-label="Send message"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
