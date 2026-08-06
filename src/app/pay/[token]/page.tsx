import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PayLinkClient } from "./pay-client";

// A payment page must never be indexed or cached — the URL itself is a
// capability, and a cached copy could serve one customer's order to another.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Secure Payment — ChineXa",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PayLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

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

      <main className="flex-1 px-4 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-lg">
          <PayLinkClient token={token} />
        </div>
      </main>

      <footer className="px-4 py-6 text-center">
        <p className="text-xs text-charcoal-lighter">
          Payments are processed securely by EPS. ChineXa never sees your card details.
        </p>
      </footer>
    </div>
  );
}
