"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Loader2, LifeBuoy, Check } from "lucide-react";
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
  is_read: boolean;
  created_at: string;
}

const ACTIVE_POLL_MS = 3000; // panel open + tab focused
const IDLE_POLL_MS = 45000; // panel closed — unread badge only

function timeLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(dateStr));
}

/** True while the tab is in the foreground — pause all chat polling otherwise. */
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

export function ChatWidget() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");
  const storeUser = useAuthStore((s) => s.user);
  const { open, pendingFlag, unread, openChat, closeChat, setUnread } = useChatStore();
  const pageVisible = useIsPageVisible();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Stable identity — memoized on primitive values only. The previous version
  // built this as a fresh object literal every render, which meant every
  // effect depending on it (loading messages, polling) tore down and re-ran
  // on every render, so the loading spinner never got a chance to resolve.
  const customerId = mounted ? storeUser?.id ?? null : null;
  const customerPhone = mounted ? storeUser?.phone ?? null : null;
  const guestId = mounted && !customerId ? getGuestId() : null;
  const identity = useMemo(() => {
    if (!mounted) return null;
    if (customerId) return { customerId, guestId: null as string | null, displayName: customerPhone || "Customer" };
    if (guestId) return { customerId: null as string | null, guestId, displayName: `guest${guestId.replace("guest", "")}` };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, customerId, customerPhone, guestId]);

  const fetchUnread = useCallback(async () => {
    if (!identity) return;
    try {
      const params = identity.customerId ? `customer_id=${identity.customerId}` : `guest_id=${identity.guestId}`;
      const res = await fetch(`/api/chat/unread-count?${params}`);
      const data = await res.json();
      if (res.ok && Number.isFinite(Number(data?.unread))) setUnread(Number(data.unread));
    } catch {}
  }, [identity, setUnread]);

  // Idle badge polling — only while the panel is closed; the open-panel effect
  // below takes over (faster cadence) once it's opened.
  useEffect(() => {
    if (isAdminRoute || !identity || open || !pageVisible) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, IDLE_POLL_MS);
    return () => clearInterval(interval);
  }, [isAdminRoute, identity, open, pageVisible, fetchUnread]);

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

  const markRead = useCallback((convId: string) => {
    fetch("/api/chat/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: convId, reader: "customer" }),
    }).catch(() => {});
  }, []);

  // Initial load when the panel opens: get-or-create conversation, fetch full
  // history once, mark read. Runs only on open/identity changes — not on every
  // render — since `identity` is now a stable memoized reference.
  useEffect(() => {
    if (!open || !identity) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const convId = conversationId || (await ensureConversation());
        if (cancelled || !convId) return;
        const res = await fetch(`/api/chat/messages?conversation_id=${convId}`);
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data)) setMessages(data);
        markRead(convId);
        setUnread(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, identity, conversationId, ensureConversation, markRead, setUnread]);

  // Delta polling while open — only fetches messages newer than the last one
  // already shown, and only while the tab is actually focused. Paused the
  // instant the tab is backgrounded or the panel is closed, so it never
  // competes with browsing/checkout for network or main-thread time.
  // Customers only ever see "Delivered" (never "Seen") — no read-state patch
  // needed here, unlike the admin side which does show read receipts.
  useEffect(() => {
    if (!open || !conversationId || !pageVisible) return;
    const interval = setInterval(async () => {
      const lastId = messages[messages.length - 1]?.id;
      try {
        const res = await fetch(
          `/api/chat/messages?conversation_id=${conversationId}${lastId ? `&after_id=${lastId}` : ""}`
        );
        const data = await res.json();
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages((prev) => [...prev, ...data.messages]);
          markRead(conversationId);
        }
      } catch {}
    }, ACTIVE_POLL_MS);
    return () => clearInterval(interval);
  }, [open, conversationId, pageVisible, messages, markRead]);

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

  const lastCustomerMessageId = [...messages].reverse().find((m) => m.sender_type === "customer")?.id;

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
                      <div className={cn("flex items-center gap-1 mt-1", m.sender_type === "customer" ? "text-white/60 justify-end" : "text-charcoal-lighter")}>
                        <span className="text-[9px]">{timeLabel(m.created_at)}</span>
                        {/* Customers only ever see "Delivered" — never a read/"Seen" receipt */}
                        {m.sender_type === "customer" && m.id === lastCustomerMessageId && (
                          <Check className="h-3 w-3" />
                        )}
                      </div>
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
                maxLength={5000}
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
