import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, XCircle, Ban } from "lucide-react";

export const metadata: Metadata = {
  title: "Payment Result — ChineXa",
  robots: { index: false, follow: false },
};

const STATES = {
  success: {
    icon: CheckCircle2,
    tone: "text-success",
    ring: "bg-success/10",
    title: "Payment Successful",
    message: "Thank you! Your payment has been received and your order is confirmed. We'll start processing it right away.",
  },
  fail: {
    icon: XCircle,
    tone: "text-destructive",
    ring: "bg-destructive/10",
    title: "Payment Failed",
    message: "Your payment could not be completed. No confirmed charge was made. You can try again from your order, or choose Cash on Delivery.",
  },
  cancel: {
    icon: Ban,
    tone: "text-warning",
    ring: "bg-warning/10",
    title: "Payment Cancelled",
    message: "You cancelled the payment. Your order is still saved — you can pay again from your orders, or place a new one with Cash on Delivery.",
  },
} as const;

export default async function PaymentResultPage({ searchParams }: { searchParams: Promise<{ order?: string; state?: string; reason?: string }> }) {
  const sp = await searchParams;
  const state = (sp.state && sp.state in STATES ? sp.state : "fail") as keyof typeof STATES;
  const cfg = STATES[state];
  const Icon = cfg.icon;

  return (
    <div className="bg-card min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${cfg.ring}`}>
          <Icon className={`h-10 w-10 ${cfg.tone}`} />
        </div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-charcoal mb-2">{cfg.title}</h1>
        <p className="text-sm text-charcoal-lighter mb-2">{cfg.message}</p>
        {state === "fail" && sp.reason === "amount" && (
          <p className="text-xs text-destructive mb-2">The paid amount did not match the order total. Please contact support if you were charged.</p>
        )}

        {state !== "success" && (
          <p className="text-xs text-charcoal-lighter mb-2">
            Your order is saved. Open it to try paying again before the payment window closes.
          </p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          {sp.order && (
            // Link to public order tracking, not the login-gated dashboard: a
            // guest who paid online (no account) could otherwise never reach
            // their order or retry payment — they'd hit the login wall.
            // /track-order is public and lets anyone look up + repay by number.
            <Link
              href={`/track-order?order=${encodeURIComponent(sp.order)}`}
              className="inline-flex items-center justify-center rounded-full bg-secondary px-6 py-2.5 text-sm font-medium !text-white hover:bg-secondary-dark transition-colors"
            >
              {state === "success" ? "View Order" : "Try Payment Again"}
            </Link>
          )}
          <Link href="/products" className="inline-flex items-center justify-center rounded-full border border-border px-6 py-2.5 text-sm font-medium text-charcoal hover:bg-pearl transition-colors">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
