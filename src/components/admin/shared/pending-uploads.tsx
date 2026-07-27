"use client";

import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";

// Coordinates DEFERRED image uploads. Each <ImageUpload> with a freshly
// selected (but not-yet-uploaded) image registers a `commit` here, keyed by its
// `field` prop. A form calls `await flushUploads()` at the start of its save
// handler; it uploads every staged image once, updates each field via onChange,
// AND returns a { field: url } map so the caller can build its payload from the
// returned URLs without waiting on React state to re-render. This means
// picking-then-changing an image never orphans a file on the server.

type CommitFn = () => Promise<string | null>; // resolves to the uploaded URL (or null if nothing staged)

interface PendingUploadsCtx {
  register: (field: string, commit: CommitFn) => void;
  unregister: (field: string) => void;
  flush: () => Promise<Record<string, string>>;
}

const Ctx = createContext<PendingUploadsCtx | null>(null);

export function PendingUploadsProvider({ children }: { children: ReactNode }) {
  const registry = useRef<Map<string, CommitFn>>(new Map());

  const register = useCallback((field: string, commit: CommitFn) => {
    registry.current.set(field, commit);
  }, []);
  const unregister = useCallback((field: string) => {
    registry.current.delete(field);
  }, []);

  const flush = useCallback(async () => {
    const entries = Array.from(registry.current.entries());
    const out: Record<string, string> = {};
    await Promise.all(entries.map(async ([field, commit]) => {
      const url = await commit();
      if (url != null) out[field] = url;
    }));
    return out;
  }, []);

  return <Ctx.Provider value={{ register, unregister, flush }}>{children}</Ctx.Provider>;
}

/**
 * Returns flush() — call at the start of a save handler:
 *   const uploaded = await flushUploads();
 *   const logo = uploaded.brand_logo ?? fLogo;   // prefer freshly-uploaded URL
 * Safe no-op (returns {}) if no provider is mounted.
 */
export function useFlushUploads(): () => Promise<Record<string, string>> {
  const ctx = useContext(Ctx);
  return ctx?.flush ?? (async () => ({}));
}

/** Internal: used by ImageUpload to register/unregister its commit. */
export function usePendingUploadRegistration() {
  return useContext(Ctx);
}

/**
 * Deletes a previously-uploaded file from the server. Call AFTER a successful
 * save when a single-image field's value changed from one uploaded file to a
 * different one (or was cleared), so the old file doesn't linger on disk.
 * Best-effort — only touches /api/uploads/* paths, ignores http(s) URLs and
 * blank values, and never throws.
 */
export async function deleteUploadedFile(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith("/api/uploads/")) return;
  try {
    await fetch(`/api/upload?url=${encodeURIComponent(url)}`, { method: "DELETE" });
  } catch { /* best-effort */ }
}

/**
 * Helper for the common "single image field" save pattern: if `oldUrl` was an
 * uploaded file and the saved value is now a DIFFERENT one (or empty), delete
 * the old file. No-op when unchanged or when the old value was an external URL.
 */
export async function cleanupReplacedImage(oldUrl: string | null | undefined, newUrl: string | null | undefined): Promise<void> {
  if (!oldUrl || oldUrl === newUrl) return;
  await deleteUploadedFile(oldUrl);
}
