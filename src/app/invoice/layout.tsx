import type { Metadata } from "next";

// Invoices are private documents — never index them.
export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

export default function InvoiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white">{children}</body>
    </html>
  );
}
