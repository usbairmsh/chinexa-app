"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Cookie, X, Settings2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  type ConsentPreferences, DEFAULT_PREFERENCES, getStoredConsent, saveConsent,
} from "@/lib/cookie-consent";

const categories: { key: keyof Omit<ConsentPreferences, "necessary">; label: string; description: string }[] = [
  {
    key: "analytics",
    label: "Analytics",
    description: "Helps us understand how visitors use the site so we can improve it.",
  },
  {
    key: "marketing",
    label: "Marketing",
    description: "Used to show you relevant offers and measure ad performance.",
  },
];

export function CookieConsent() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<ConsentPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (isAdminRoute) return;
    if (!getStoredConsent()) setVisible(true);
  }, [isAdminRoute]);

  const acceptAll = () => {
    saveConsent({ necessary: true, analytics: true, marketing: true });
    setVisible(false);
    setSettingsOpen(false);
  };

  const rejectNonEssential = () => {
    saveConsent({ necessary: true, analytics: false, marketing: false });
    setVisible(false);
    setSettingsOpen(false);
  };

  const saveCustom = () => {
    saveConsent(prefs);
    setVisible(false);
    setSettingsOpen(false);
  };

  const openSettings = () => {
    setPrefs(getStoredConsent()?.preferences || DEFAULT_PREFERENCES);
    setSettingsOpen(true);
  };

  if (isAdminRoute) return null;

  return (
    <>
      <AnimatePresence>
        {visible && !settingsOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[26rem]"
          >
            <div className="flex items-start gap-3 rounded-2xl border border-border/30 bg-white p-4 shadow-[0_8px_40px_rgba(0,0,0,0.15)]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-secondary">
                <Cookie className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-charcoal">We use cookies</p>
                <p className="mt-0.5 text-xs leading-relaxed text-charcoal-lighter">
                  We use essential cookies to keep you signed in, plus optional analytics and marketing cookies to improve your experience. See our{" "}
                  <Link href="/policies/privacy" className="text-secondary hover:underline">Privacy Policy</Link>.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={acceptAll}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-secondary-dark"
                  >
                    Accept All
                  </button>
                  <button
                    onClick={rejectNonEssential}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-charcoal transition-all hover:bg-pearl"
                  >
                    Reject Non-Essential
                  </button>
                  <button
                    onClick={openSettings}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-2 text-xs font-semibold text-charcoal-lighter transition-colors hover:text-charcoal"
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Customize
                  </button>
                </div>
              </div>

              <button
                onClick={rejectNonEssential}
                className="shrink-0 rounded-full p-1.5 text-charcoal-lighter transition-colors hover:bg-pearl hover:text-charcoal"
                aria-label="Dismiss — reject non-essential cookies"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-secondary" /> Cookie Preferences
            </DialogTitle>
            <DialogDescription>
              Choose which cookies you&apos;re comfortable with. You can change this anytime from the footer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="flex items-start justify-between gap-4 rounded-xl bg-pearl/50 p-3">
              <div>
                <p className="text-sm font-medium text-charcoal">Strictly Necessary</p>
                <p className="text-xs text-charcoal-lighter mt-0.5">Required for login and core site features. Always on.</p>
              </div>
              <Switch checked disabled className="mt-0.5" />
            </div>

            {categories.map((cat) => (
              <div key={cat.key} className="flex items-start justify-between gap-4 rounded-xl bg-pearl/50 p-3">
                <div>
                  <p className="text-sm font-medium text-charcoal">{cat.label}</p>
                  <p className="text-xs text-charcoal-lighter mt-0.5">{cat.description}</p>
                </div>
                <Switch
                  checked={prefs[cat.key]}
                  onCheckedChange={(checked) => setPrefs((p) => ({ ...p, [cat.key]: checked }))}
                  className="mt-0.5"
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <button
              onClick={rejectNonEssential}
              className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-xs font-semibold text-charcoal transition-all hover:bg-pearl"
            >
              Reject Non-Essential
            </button>
            <button
              onClick={saveCustom}
              className="inline-flex items-center justify-center rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-secondary-dark"
            >
              Save Preferences
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
