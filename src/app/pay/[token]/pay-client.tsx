"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Clock, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";

interface LinkItem {
  name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface LinkData {
  standalone: boolean;
  /** Standalone links carry a PAY- reference; order-backed ones an order number. */
  reference?: string | null;
  order_number?: string;
  customer_first_name?: string | null;
  amount: number;
  description: string | null;
  items: LinkItem[];
  expires_at: string;
  payable: boolean;
  blocked_reason: null | "expired" | "revoked" | "already_paid" | "order_cancelled";
}

const money = (n: number) => `৳${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Human copy per blocked state — each explains what to do next, not just what failed. */
const BLOCKED: Record<string, { icon: typeof XCircle; title: string; message: string; tone: string; ring: string }> = {
  already_paid: {
    icon: CheckCircle2,
    title: "Already Paid",
    message: "This has already been paid for. No further payment is needed — thank you!",
    tone: "text-success",
    ring: "bg-success/10",
  },
  expired: {
    icon: Clock,
    title: "Link Expired",
    message: "This payment link has expired. Please contact us and we'll send you a fresh one right away.",
    tone: "text-warning",
    ring: "bg-warning/10",
  },
  revoked: {
    icon: XCircle,
    title: "Link No Longer Valid",
    message: "This payment link has been cancelled. Please contact us if you still need to make this payment.",
    tone: "text-charcoal-lighter",
    ring: "bg-border/40",
  },
  order_cancelled: {
    icon: XCircle,
    title: "Order Cancelled",
    message: "This order was cancelled, so it can no longer be paid for. Please contact us if this looks wrong.",
    tone: "text-destructive",
    ring: "bg-destructive/10",
  },
};

function useCountdown(expiresAt: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const deadline = new Date(expiresAt).getTime();
    const tick = () => setLeft(Math.max(0, deadline - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return left;
}

export function PayLinkClient({ token }: { token: string }) {
  const [data, setData] = useState<LinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(token)}`, { cache: "no-store" });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not load this payment link.");
        return;
      }
      setData(json);
    } catch {
      setError("Could not reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const msLeft = useCountdown(data?.expires_at || null);

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/eps/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The token is the ONLY credential — no customer_id or phone, because
        // the payer may have no account and may not be the number on the order.
        body: JSON.stringify({ order_id: null, link_token: token }),
      });
      const json = await res.json();
      if (res.ok && json.redirect_url) {
        window.location.href = json.redirect_url;
        return;
      }
      setError(json.error || "Could not start the payment. Please try again.");
      setPaying(false);
      // Re-read: the link may have just been paid, revoked, or expired.
      void load();
    } catch {
      setError("Could not reach the payment gateway. Please try again.");
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-card border border-border p-10 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-secondary mx-auto" />
        <p className="mt-3 text-sm text-charcoal-lighter">Loading your payment details…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="rounded-2xl bg-card border border-border p-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="font-heading text-xl font-bold text-charcoal mb-2">Payment Link Not Found</h1>
        <p className="text-sm text-charcoal-lighter">
          This link isn&apos;t valid. Please double-check the link we sent you, or contact us for a new one.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-card border border-border p-8 text-center">
        <p className="text-sm text-destructive">{error || "Something went wrong."}</p>
      </div>
    );
  }

  if (!data.payable && data.blocked_reason) {
    const cfg = BLOCKED[data.blocked_reason];
    const Icon = cfg.icon;
    return (
      <div className="rounded-2xl bg-card border border-border p-8 text-center">
        <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${cfg.ring}`}>
          <Icon className={`h-8 w-8 ${cfg.tone}`} />
        </div>
        <h1 className="font-heading text-xl font-bold text-charcoal mb-2">{cfg.title}</h1>
        <p className="text-sm text-charcoal-lighter mb-4">{cfg.message}</p>
        {(data.reference || data.order_number) && (
          <p className="text-xs text-charcoal-lighter">
            {data.standalone ? "Reference" : "Order"}{" "}
            <span className="font-medium text-charcoal">{data.reference || data.order_number}</span>
          </p>
        )}
      </div>
    );
  }

  const hoursLeft = msLeft !== null ? Math.floor(msLeft / 3_600_000) : null;
  const minsLeft = msLeft !== null ? Math.floor((msLeft % 3_600_000) / 60_000) : null;
  const urgent = msLeft !== null && msLeft < 60 * 60_000;
  const expiredNow = msLeft !== null && msLeft <= 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-6 pt-6 pb-5 text-center border-b border-border">
          <p className="text-xs uppercase tracking-wider text-charcoal-lighter mb-1">Amount due</p>
          <p className="font-heading text-4xl font-bold text-charcoal tabular-nums">{money(data.amount)}</p>
          {data.standalone ? (
            <>
              {data.description && <p className="mt-2 text-sm text-charcoal">{data.description}</p>}
              {data.reference && (
                <p className="mt-1 text-xs text-charcoal-lighter">Ref {data.reference}</p>
              )}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-charcoal-lighter">
                {data.customer_first_name ? `${data.customer_first_name}, order ` : "Order "}
                <span className="font-medium text-charcoal">{data.order_number}</span>
              </p>
              {data.description && <p className="mt-1 text-sm text-charcoal-lighter">{data.description}</p>}
            </>
          )}
        </div>

        {data.items.length > 0 && (
          <ul className="divide-y divide-border">
            {data.items.map((it, i) => (
              <li key={i} className="flex items-start justify-between gap-3 px-6 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-charcoal truncate">{it.name}</p>
                  <p className="text-xs text-charcoal-lighter">
                    {it.variant ? `${it.variant} · ` : ""}Qty {it.quantity} × {money(it.unit_price)}
                  </p>
                </div>
                <span className="text-sm text-charcoal tabular-nums shrink-0">{money(it.total_price)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="px-6 py-5 border-t border-border">
          {expiredNow ? (
            <p className="text-center text-sm text-warning">
              This payment link has just expired. Please contact us for a new one.
            </p>
          ) : (
            <>
              <button
                onClick={handlePay}
                disabled={paying}
                // !text-white so no layered rule can win the cascade and render
                // the label dark — see components/ui/button.tsx for the history.
                className="w-full rounded-full bg-secondary px-6 py-3.5 text-sm font-semibold !text-white hover:bg-secondary-dark hover:!text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting to payment…
                  </>
                ) : (
                  <>Pay {money(data.amount)} securely</>
                )}
              </button>

              {msLeft !== null && (
                <p className={`mt-3 text-center text-xs ${urgent ? "text-warning font-medium" : "text-charcoal-lighter"}`}>
                  <Clock className="inline h-3 w-3 mr-1 -mt-0.5" />
                  Link expires in {hoursLeft! > 0 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft}m`}
                </p>
              )}
            </>
          )}

          {error && <p className="mt-3 text-center text-xs text-destructive">{error}</p>}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-charcoal-lighter">
        <ShieldCheck className="h-4 w-4 text-success" />
        <span>Secured by EPS · Card, bKash, Nagad &amp; Rocket accepted</span>
      </div>

      {/* The EPS banner ships as two files, one per theme — same pair the
          storefront footer uses. There are no per-method icons in public/eps. */}
      <div className="flex items-center justify-center px-2">
        <img
          src="/eps/eps-footer-light.png"
          alt="Pay with EPS — Visa, Mastercard, Amex, bKash, Nagad, Rocket and more"
          className="h-8 sm:h-9 w-auto max-w-full dark:hidden"
        />
        <img
          src="/eps/eps-footer-dark.png"
          alt="Pay with EPS — Visa, Mastercard, Amex, bKash, Nagad, Rocket and more"
          className="h-8 sm:h-9 w-auto max-w-full hidden dark:block"
        />
      </div>
    </div>
  );
}
