import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-luxury-gradient px-4 py-8 sm:py-12">
      <Link href="/" className="mb-6 sm:mb-8">
        <Image src="/logo.png" alt="ChineXa" width={480} height={186} className="h-24 sm:h-32 lg:h-[192px] w-auto" />
      </Link>
      <div className="w-full max-w-md">
        {children}
      </div>
      <p className="mt-8 text-xs text-charcoal-lighter text-center">
        By continuing, you agree to our{" "}
        <Link href="/policies/terms" className="underline hover:text-secondary">Terms of Service</Link>
        {" "}and{" "}
        <Link href="/policies/privacy" className="underline hover:text-secondary">Privacy Policy</Link>
      </p>
    </div>
  );
}
