"use client";

import { useState, useEffect } from "react";
import { CreditCard, Loader2, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Pay Now" for an EPS order whose payment wasn't completed (customer closed the
 * gateway, lost connection, or cancelled). Shows a live countdown of the payment
 * window — once it runs out the order is auto-cancelled and its stock released
 * by the reconcile job, so the timer is a real deadline, not decoration.
 *
 * Rendered only for orders that are actually payable; the server re-checks
 * ownership, status and the window on every attempt.
 */

/** Minutes an unpaid EPS order stays payable. Mirrors EPS_PAYMENT_WINDOW_MINUTES. */
const WINDOW_MINUTES = 60;

export function isAwaitingPayment(order: {
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
}): boolean {
  const method = (order.payment_method || "").toUpperCase();
  const pay = (order.payment_status || "").toLowerCase();
  const status = (order.status || "").toLowerCase();
  return (
    method === "EPS" &&
    (pay === "pending" || pay === "failed") &&
    !["cancelled", "returned", "received", "not_received"].includes(status)
  );
}

function useCountdown(deadlineMs: number) {
  const [remaining, setRemaining] = useState(() => deadlineMs - Date.now());
  useEffect(() => {
    const tick = () => setRemaining(deadlineMs - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineMs]);
  return remaining;
}

export function PayNow({
  orderId,
  createdAt,
  customerId,
  phone,
  className,
  compact = false,
}: {
  orderId: string;
  createdAt: string;
  customerId?: string | null;
  phone?: string | null;
  className?: string;
  compact?: boolean;
}) {
  const deadline = new Date(createdAt).getTime() + WINDOW_MINUTES * 60_000;
  const remaining = useCountdown(deadline);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const expired = remaining <= 0;
  const mins = Math.max(0, Math.floor(remaining / 60_000));
  const secs = Math.max(0, Math.floor((remaining % 60_000) / 1000));
  // Under 10 minutes reads as urgent.
  const urgent = !expired && remaining < 10 * 60_000;

  const pay = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/payment/eps/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, customer_id: customerId || null, phone: phone || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }
      setError(data.error || "Could not start payment. Please try again.");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (expired) {
    return (
      <div className={cn("flex items-center gap-1.5 text-[11px] text-destructive", className)}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>Payment window closed — this order is being cancelled.</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={pay}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 font-semibold text-white transition-all hover:bg-secondary-dark active:scale-[0.97] disabled:opacity-60",
            compact ? "py-1.5 text-xs" : "py-2.5 text-sm"
          )}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
          {busy ? "Starting…" : "Pay Now"}
        </button>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium tabular-nums",
            urgent ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
          )}
        >
          <Clock className="h-3 w-3" />
          {mins}:{String(secs).padStart(2, "0")} left
        </span>
      </div>
      {!compact && (
        <p className="text-[11px] text-charcoal-lighter">
          Complete payment within the time shown or this order is cancelled automatically and the items are released.
        </p>
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
