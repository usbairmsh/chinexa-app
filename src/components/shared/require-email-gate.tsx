"use client";

import { useEffect, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";

// Email is now required for all accounts, but customers who registered before
// that (email was optional then) may have none on file. This gate — mounted in
// the account layout — checks the customer's CURRENT email server-side (not the
// possibly-stale auth store) and, if missing, blocks with a modal to add one.
// It only ever appears for the small set of legacy email-less accounts.
export function RequireEmailGate() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Authoritative check against the server — the store's email can be stale.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetch(`/api/customers/${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (!data.email || !String(data.email).trim()) setNeedsEmail(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  const save = async () => {
    setError("");
    const val = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setError("Please enter a valid email address"); return; }
    if (!user?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: val }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't save your email");
      updateUser({ email: val });
      setNeedsEmail(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your email");
    } finally {
      setSaving(false);
    }
  };

  // Non-dismissible: no email = must add one to continue.
  return (
    <Dialog open={needsEmail} onOpenChange={() => { /* blocking */ }}>
      <DialogContent className="w-[95vw] max-w-md" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-secondary" /> Add your email</DialogTitle>
          <DialogDescription>
            We now use email for order confirmations and updates. Please add an email address to continue.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input
            label="Email address"
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="secondary" className="w-full" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
