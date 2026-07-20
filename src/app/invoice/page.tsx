"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useStoreSettings } from "@/hooks/use-store-settings";

interface OrderData {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  payment_method: string;
  payment_status: string;
  transaction_id?: string;
  subtotal: number;
  shipping_cost: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
  created_at: string;
  items: { product_name: string; variant?: string; quantity: number; unit_price: number; total_price: number }[];
  billing_address?: { name: string; phone: string; email?: string; address_line_1: string; address_line_2?: string; city?: string; district?: string; division?: string; postal_code?: string };
  shipping_address?: { name: string; phone: string; address_line_1: string; address_line_2?: string; city?: string; district?: string; division?: string; postal_code?: string };
  redacted?: boolean;
}

const statusLabels: Record<string, string> = {
  pending: "Pending", confirmed: "Confirmed", processing: "Processing",
  shipped: "Shipped", on_delivery: "On Delivery", received: "Received",
  not_received: "Not Received",
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatCurrency(amount: number) {
  return `৳${Number(amount).toLocaleString("en-BD")}`;
}

function formatAddress(addr: OrderData["billing_address"]) {
  if (!addr) return "";
  const parts = [addr.address_line_1, addr.address_line_2, addr.city, addr.district, addr.division, addr.postal_code].filter(Boolean);
  return parts.join(", ");
}

function InvoiceContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("id") || "";
  // Admin opens this with no params (its own session cookie proves access).
  // A customer opening their own invoice needs to prove ownership the same
  // way the rest of the app does — pass customer_id through so this gets the
  // real address/name instead of a redacted, PII-stripped response.
  const customerId = searchParams.get("customer_id") || "";
  const { store_name, store_email, store_phone, loaded: settingsLoaded } = useStoreSettings();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    const url = customerId
      ? `/api/orders/${encodeURIComponent(orderId)}?customer_id=${encodeURIComponent(customerId)}`
      : `/api/orders/${encodeURIComponent(orderId)}`;
    fetch(url)
      .then((r) => r.json())
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId, customerId]);

  // Auto-print once loaded — wait on store settings too, so a real phone/email
  // ends up on the printed page rather than the placeholder defaults.
  useEffect(() => {
    if (order && !loading && settingsLoaded) {
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [order, loading, settingsLoaded]);

  if (loading || !settingsLoaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <Loader2 style={{ height: 32, width: 32, animation: "spin 1s linear infinite", color: "#999" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // A redacted response means ownership couldn't be verified (missing/wrong
  // customer_id) — never render an invoice missing the customer's own name/
  // address, since that would print as a silently-broken document instead of
  // a clear failure.
  if (!order || order.redacted) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: "#666" }}>
        Order not found
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a1a; background: #f5f5f5; }
        @media print {
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .invoice-wrapper { box-shadow: none !important; margin: 0 !important; max-width: none !important; padding: 20px !important; }
          @page { size: A4; margin: 12mm 15mm; }
        }
        @media (max-width: 640px) {
          .invoice-wrapper { padding: 16px !important; margin-top: 56px !important; }
          .invoice-header { flex-direction: column !important; gap: 16px !important; }
          .invoice-header > div:last-child { text-align: left !important; }
          .invoice-header > div:last-child table { margin-left: 0 !important; }
          .invoice-addresses { grid-template-columns: 1fr !important; gap: 16px !important; }
          .invoice-toolbar { padding: 8px 12px !important; }
          .invoice-toolbar span { font-size: 12px !important; }
          .invoice-toolbar button { padding: 6px 12px !important; font-size: 12px !important; }
          .invoice-totals { width: 100% !important; }
          .invoice-logo { height: 60px !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Toolbar — hidden in print */}
      <div className="no-print invoice-toolbar" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "#1a1a1a", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>Invoice — {order.order_number}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ padding: "8px 20px", background: "#C0392B", color: "#fff", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer" }}>
            Print / Save PDF
          </button>
          <button onClick={() => window.close()} style={{ padding: "8px 20px", background: "#444", color: "#fff", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer" }}>
            Close
          </button>
        </div>
      </div>

      {/* Invoice Body */}
      <div className="invoice-wrapper" style={{ maxWidth: 800, margin: "72px auto 40px", background: "#fff", padding: "40px", boxShadow: "0 2px 20px rgba(0,0,0,0.08)", borderRadius: 8 }}>

        {/* Header */}
        <div className="invoice-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 20, borderBottom: "2px solid #C0392B" }}>
          <div>
            <Image src="/logo.png" alt={store_name} width={320} height={124} className="invoice-logo" style={{ height: 90, width: "auto", marginBottom: 10 }} unoptimized />
            <div style={{ fontSize: 9, color: "#999", lineHeight: 1.6 }}>
              Premium Beauty & Lifestyle<br />
              Dhaka, Bangladesh<br />
              {store_email} | {store_phone}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#C0392B", marginBottom: 6, letterSpacing: 1 }}>INVOICE</div>
            <table style={{ marginLeft: "auto", fontSize: 10, color: "#555", borderSpacing: "4px 2px", borderCollapse: "separate" }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: "right", fontWeight: 500, color: "#999", paddingRight: 6 }}>Invoice No:</td>
                  <td style={{ fontWeight: 700, color: "#1a1a1a", fontSize: 10 }}>{order.order_number}</td>
                </tr>
                <tr>
                  <td style={{ textAlign: "right", fontWeight: 500, color: "#999", paddingRight: 6 }}>Date:</td>
                  <td>{formatDate(order.created_at)}</td>
                </tr>
                <tr>
                  <td style={{ textAlign: "right", fontWeight: 500, color: "#999", paddingRight: 6 }}>Status:</td>
                  <td><span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700, background: "#f0f0f0", color: "#555" }}>{statusLabels[order.status] || order.status}</span></td>
                </tr>
                <tr>
                  <td style={{ textAlign: "right", fontWeight: 500, color: "#999", paddingRight: 6 }}>Payment:</td>
                  <td style={{ textTransform: "capitalize" }}>{order.payment_method}</td>
                </tr>
                <tr>
                  <td style={{ textAlign: "right", fontWeight: 500, color: "#999", paddingRight: 6 }}>Paid:</td>
                  <td><span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700, background: order.payment_status === "paid" ? "#ecfdf5" : "#fffbeb", color: order.payment_status === "paid" ? "#047857" : "#b45309" }}>{order.payment_status === "paid" ? "Paid" : "Pending"}</span></td>
                </tr>
                {order.transaction_id && (
                  <tr>
                    <td style={{ textAlign: "right", fontWeight: 500, color: "#999", paddingRight: 6 }}>TXN ID:</td>
                    <td style={{ fontFamily: "monospace", fontSize: 9 }}>{order.transaction_id}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bill To / Ship To */}
        <div className="invoice-addresses" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "#bbb", marginBottom: 6 }}>Bill To</div>
            <div style={{ fontWeight: 600, fontSize: 11, color: "#1a1a1a" }}>{order.billing_address?.name || order.customer_name}</div>
            <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>{order.billing_address?.phone || order.customer_phone}</div>
            {order.billing_address?.email && <div style={{ fontSize: 10, color: "#666" }}>{order.billing_address.email}</div>}
            <div style={{ fontSize: 9, color: "#999", marginTop: 3 }}>{formatAddress(order.billing_address)}</div>
          </div>
          <div>
            <div style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "#bbb", marginBottom: 6 }}>Ship To</div>
            <div style={{ fontWeight: 600, fontSize: 11, color: "#1a1a1a" }}>{order.shipping_address?.name || order.customer_name}</div>
            <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>{order.shipping_address?.phone || order.customer_phone}</div>
            <div style={{ fontSize: 9, color: "#999", marginTop: 3 }}>{formatAddress(order.shipping_address)}</div>
          </div>
        </div>

        {/* Items Table */}
        <div style={{ overflowX: "auto", marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
          <thead>
            <tr style={{ background: "#C0392B" }}>
              <th style={{ textAlign: "left", padding: "7px 10px", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#fff", borderRadius: "6px 0 0 0" }}>#</th>
              <th style={{ textAlign: "left", padding: "7px 10px", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#fff" }}>Item Description</th>
              <th style={{ textAlign: "center", padding: "7px 10px", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#fff" }}>Qty</th>
              <th style={{ textAlign: "right", padding: "7px 10px", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#fff" }}>Unit Price</th>
              <th style={{ textAlign: "right", padding: "7px 10px", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#fff", borderRadius: "0 6px 0 0" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fafafa" : "#fff" }}>
                <td style={{ padding: "7px 10px", fontSize: 10, color: "#bbb" }}>{i + 1}</td>
                <td style={{ padding: "7px 10px" }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: "#1a1a1a" }}>{item.product_name}</div>
                  {item.variant && <div style={{ fontSize: 8, color: "#999", marginTop: 1 }}>{item.variant}</div>}
                </td>
                <td style={{ padding: "7px 10px", textAlign: "center", fontSize: 11, color: "#555" }}>{item.quantity}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 11, color: "#555" }}>{formatCurrency(Number(item.unit_price))}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#1a1a1a" }}>{formatCurrency(Number(item.total_price))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
          <div className="invoice-totals" style={{ width: 240 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: "#666" }}>
              <span>Subtotal</span>
              <span>{formatCurrency(Number(order.subtotal))}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: "#666" }}>
              <span>Shipping</span>
              <span>{Number(order.shipping_cost) === 0 ? "Free" : formatCurrency(Number(order.shipping_cost))}</span>
            </div>
            {Number(order.discount) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: "#047857" }}>
                <span>Discount</span>
                <span>-{formatCurrency(Number(order.discount))}</span>
              </div>
            )}
            {Number(order.tax) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: "#666" }}>
                <span>Tax</span>
                <span>{formatCurrency(Number(order.tax))}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", marginTop: 3, borderTop: "2px solid #C0392B", fontWeight: 800, fontSize: 13, color: "#1a1a1a" }}>
              <span>Total</span>
              <span>{formatCurrency(Number(order.total))}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div style={{ marginBottom: 24, padding: 12, background: "#f9f9f9", borderRadius: 6, border: "1px solid #eee" }}>
            <div style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "#bbb", marginBottom: 3 }}>Notes</div>
            <div style={{ fontSize: 9, color: "#666" }}>{order.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "1px solid #eee", paddingTop: 24, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#999", marginBottom: 3 }}>Thank you for shopping with {store_name}!</div>
          <div style={{ fontSize: 8, color: "#ccc" }}>This is a computer-generated invoice and does not require a signature.</div>
        </div>
      </div>
    </>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <Loader2 style={{ height: 32, width: 32, animation: "spin 1s linear infinite", color: "#999" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <InvoiceContent />
    </Suspense>
  );
}
