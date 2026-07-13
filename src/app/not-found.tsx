import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-luxury-gradient px-4 text-center">
      <h1 className="font-heading text-8xl font-bold text-primary-dark mb-4">404</h1>
      <h2 className="font-heading text-2xl font-semibold text-charcoal mb-2">
        Page Not Found
      </h2>
      <p className="text-charcoal-lighter mb-8 max-w-md">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-luxury bg-secondary !text-white px-6 py-3 text-sm font-medium hover:bg-secondary-dark transition-colors"
        >
          Go Home
        </Link>
        <Link
          href="/products"
          className="inline-flex items-center justify-center rounded-luxury border border-border px-6 py-3 text-sm font-medium text-charcoal hover:bg-primary-light transition-colors"
        >
          Browse Products
        </Link>
      </div>
    </div>
  );
}
