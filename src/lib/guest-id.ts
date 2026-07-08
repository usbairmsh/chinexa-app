const GUEST_ID_KEY = "chinexa-guest-chat-id";

/** Stable per-browser guest identity for unauthenticated chat, e.g. "guest847293016482". */
export function getGuestId(): string {
  try {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing) return existing;
    const id = `guest${Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("")}`;
    localStorage.setItem(GUEST_ID_KEY, id);
    return id;
  } catch {
    return `guest${Date.now()}`;
  }
}
