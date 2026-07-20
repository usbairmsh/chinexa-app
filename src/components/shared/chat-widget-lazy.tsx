"use client";

import dynamic from "next/dynamic";

// ssr:false requires a Client Component boundary in the App Router — this
// file exists solely to hold that directive; the root layout (a Server
// Component) can't call dynamic(..., { ssr: false }) directly.
export const ChatWidget = dynamic(() => import("@/components/shared/chat-widget").then((m) => m.ChatWidget), { ssr: false });
