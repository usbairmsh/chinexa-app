"use client";

import { create } from "zustand";

interface ChatState {
  open: boolean;
  pendingFlag: "general" | "help_and_support";
  unread: number;

  openChat: (flag?: "general" | "help_and_support") => void;
  closeChat: () => void;
  setUnread: (count: number) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  open: false,
  pendingFlag: "general",
  unread: 0,

  openChat: (flag = "general") => set({ open: true, pendingFlag: flag }),
  closeChat: () => set({ open: false }),
  setUnread: (count) => set({ unread: count }),
}));
