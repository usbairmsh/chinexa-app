"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { X, Share, PlusSquare, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getStoredConsent } from "@/lib/cookie-consent";

const DISMISS_KEY = "chinexa-install-dismissed-at";
const DISMISS_DAYS = 14;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own flag for "launched from home screen"
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    return daysSince < DISMISS_DAYS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
}

/**
 * Prompts the visitor to install the storefront as an app.
 * - Android / desktop Chrome & Edge: captures the native `beforeinstallprompt`
 *   event and shows a banner whose button triggers the real install dialog.
 * - iOS Safari: never fires that event, so we detect iOS + not-yet-installed
 *   and show instructions for the manual "Share → Add to Home Screen" flow.
 * Suppressed entirely once already installed, or for 14 days after dismissal.
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Admin is a separate operational tool — never offer the storefront's
  // "install our shopping app" banner there.
  const isAdminRoute = pathname?.startsWith("/admin");

  useEffect(() => {
    if (isAdminRoute || isStandalone() || wasRecentlyDismissed()) return;

    // The cookie-consent banner takes priority — don't compete with it for
    // the same bottom-corner real estate. Wait until the visitor has decided
    // (or already had decided on a prior visit) before offering the install prompt.
    let cancelled = false;
    const waitForConsent = () =>
      new Promise<void>((resolve) => {
        if (getStoredConsent()) { resolve(); return; }
        const onDecided = () => {
          window.removeEventListener("chinexa-consent-updated", onDecided);
          resolve();
        };
        window.addEventListener("chinexa-consent-updated", onDecided);
      });

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

    if (isIos && isSafari) {
      // No install-readiness signal on iOS — show after a short delay so it
      // doesn't compete with the initial page-load experience.
      waitForConsent().then(() => {
        if (cancelled) return;
        const timer = setTimeout(() => { if (!cancelled) { setShowIosBanner(true); setVisible(true); } }, 4000);
        return () => clearTimeout(timer);
      });
      return () => { cancelled = true; };
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      waitForConsent().then(() => { if (!cancelled) setVisible(true); });
    };
    window.addEventListener("beforeinstallprompt", handler);
    // If the browser installs it another way (e.g. omnibox icon), hide our banner.
    const onInstalled = () => { setVisible(false); markDismissed(); };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [isAdminRoute]);

  const handleDismiss = () => {
    setVisible(false);
    markDismissed();
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") markDismissed();
    } catch {
      // ignore — user likely dismissed the native dialog
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
      setVisible(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-96"
        >
          <div className="flex items-start gap-3 rounded-2xl border border-border/30 bg-white p-4 shadow-[0_8px_40px_rgba(0,0,0,0.15)]">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-pearl">
              <Image src="/favicon/android-chrome-192x192.png" alt="ChineXa" fill className="object-cover" sizes="44px" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-charcoal">Install ChineXa</p>
              {showIosBanner ? (
                <p className="mt-0.5 text-xs leading-relaxed text-charcoal-lighter">
                  Tap <Share className="inline h-3 w-3 -translate-y-px" aria-hidden /> Share, then{" "}
                  <PlusSquare className="inline h-3 w-3 -translate-y-px" aria-hidden /> &ldquo;Add to Home Screen&rdquo;.
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-charcoal-lighter">
                  Add the app to your home screen for a faster, full-screen shopping experience.
                </p>
              )}

              {!showIosBanner && (
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-secondary-dark disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  {installing ? "Installing..." : "Install App"}
                </button>
              )}
            </div>

            <button
              onClick={handleDismiss}
              className="shrink-0 rounded-full p-1.5 text-charcoal-lighter transition-colors hover:bg-pearl hover:text-charcoal"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
