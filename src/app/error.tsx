"use client";

import { useEffect } from "react";
import Link from "next/link";

// Route-segment error boundary. Without this, an unhandled render error in any
// page anywhere in the app fell through to Next's bare default, which in
// production is a blank white screen. This catches it and shows a branded,
// recoverable page instead.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaced in server logs (the digest correlates the client error with the
    // server-side stack) so a real bug is still diagnosable.
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-luxury-gradient px-4 text-center">
      <h1 className="font-heading text-6xl font-bold text-primary-dark mb-4">Something went wrong</h1>
      <p className="text-charcoal-lighter mb-8 max-w-md">
        A temporary error stopped this page from loading. You can try again, or head back home.
      </p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-luxury bg-secondary !text-white px-6 py-3 text-sm font-medium hover:bg-secondary-dark transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-luxury border border-border px-6 py-3 text-sm font-medium text-charcoal hover:bg-primary-light transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
