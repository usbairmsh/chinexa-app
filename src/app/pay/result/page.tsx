import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, XCircle, Ban } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment Result — ChineXa",
  robots: { index: false, follow: false, nocache: true },
};

// Result page for STANDALONE payment links. Separate from /checkout/result,
// which is written around an order (it links to order history and offers a
// retry against that order) — neither of which exists here.
const STATES = {
  success: {
    icon: CheckCircle2,
    tone: "text-success",
    ring: "bg-success/10",
    title: "Payment Successful",
    message: "Thank you! Your payment has been received. Please keep this page or your SMS as confirmation.",
  },
  fail: {
    icon: XCircle,
    tone: "text-destructive",
    ring: "bg-destructive/10",
    title: "Payment Failed",
    message: "Your payment could not be completed and no confirmed charge was made. You can open your payment link again to retry.",
  },
  cancel: {
    icon: Ban,
    tone: "text-warning",
    ring: "bg-warning/10",
    title: "Payment Cancelled",
    message: "You cancelled the payment. Your link is still valid — you can open it again to pay before it expires.",
  },
} as const;

export default async function PayResultPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; reason?: string }>;
}) {
  const sp = await searchParams;
  const state = (sp.state && sp.state in STATES ? sp.state : "fail") as keyof typeof STATES;
  const cfg = STATES[state];
  const Icon = cfg.icon;

  return (
    <div className="min-h-screen bg-pearl flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-lg px-4 py-4 flex items-center justify-center">
          <Link href="/" aria-label="ChineXa home">
            <Image
              src="/logo.png"
              alt="ChineXa"
              width={200}
              height={76}
              priority
              className="h-10 w-auto dark:bg-image-surface dark:rounded-lg dark:px-2 dark:py-1"
            />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${cfg.ring}`}>
            <Icon className={`h-10 w-10 ${cfg.tone}`} />
          </div>
          <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">{cfg.title}</h1>
          <p className="text-sm text-charcoal-lighter">{cfg.message}</p>
          {state === "fail" && sp.reason === "amount" && (
            <p className="mt-2 text-xs text-destructive">
              The paid amount did not match the requested amount. Please contact us if you were charged.
            </p>
          )}

          <Link
            href="/"
            className="mt-8 inline-flex items-center justify-center rounded-full border border-border px-6 py-2.5 text-sm font-medium text-charcoal hover:bg-card transition-colors"
          >
            Go to ChineXa
          </Link>
        </div>
      </main>

      <footer className="px-4 py-6 text-center">
        <p className="text-xs text-charcoal-lighter">Payments are processed securely by EPS.</p>
      </footer>
    </div>
  );
}
