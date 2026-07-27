"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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

interface InvoiceSettings {
  tagline: string; tax_reg_no: string; website: string; signature_image: string;
  bank_account_holder: string; bank_name: string; bank_routing: string;
  bank_account_no: string; bank_iban: string; bank_swift: string; bank_address: string;
}

const TEAL = "#159A8C";
const INK = "#2f3b3a";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, ".");
}

function formatCurrency(amount: number) {
  return `৳${Number(amount).toLocaleString("en-BD")}`;
}

function InvoiceContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("id") || "";
  // Admin opens this with no params (its own session cookie proves access).
  // A customer opening their own invoice needs to prove ownership the same
  // way the rest of the app does — pass customer_id through so this gets the
  // real address/name instead of a redacted, PII-stripped response.
  const customerId = searchParams.get("customer_id") || "";
  const { store_name, store_email, store_phone, store_address, loaded: settingsLoaded } = useStoreSettings();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  // Admin-entered invoice fields (bank block, tagline, signature, tax reg) +
  // the store logo, loaded from settings.
  const [inv, setInv] = useState<InvoiceSettings | null>(null);
  const [logo, setLogo] = useState("/logo.png");
  const [invLoaded, setInvLoaded] = useState(false);

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

  useEffect(() => {
    fetch("/api/settings?keys=invoice,store_logo")
      .then((r) => r.json())
      .then((d) => {
        if (d?.invoice) setInv(d.invoice);
        if (d?.store_logo) setLogo(d.store_logo);
      })
      .catch(() => {})
      .finally(() => setInvLoaded(true));
  }, []);

  // Auto-print once loaded — wait on store settings too, so a real phone/email
  // ends up on the printed page rather than the placeholder defaults.
  useEffect(() => {
    if (order && !loading && settingsLoaded && invLoaded) {
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [order, loading, settingsLoaded, invLoaded]);

  if (loading || !settingsLoaded || !invLoaded) {
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

  const bill = order.billing_address;
  const bankRows: [string, string | undefined][] = [
    ["Account Holder", inv?.bank_account_holder],
    ["Bank", inv?.bank_name],
    ["Routing No.", inv?.bank_routing],
    ["Account No.", inv?.bank_account_no],
    ["IBAN", inv?.bank_iban],
    ["SWIFT", inv?.bank_swift],
  ];
  const hasBank = bankRows.some(([, v]) => v) || inv?.bank_address;

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: ${INK}; background: #f0f0f0; }
        @media print {
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .inv-wrap { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
          @page { size: A4; margin: 10mm; }
        }
        @media (max-width: 680px) {
          .inv-wrap { margin-top: 56px !important; }
          .inv-pad { padding: 24px !important; }
          .inv-top { flex-direction: column-reverse !important; gap: 16px !important; align-items: flex-start !important; }
          .inv-banner { flex-direction: column !important; }
          .inv-banner > div { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.15) !important; }
          .inv-foot { flex-direction: column !important; gap: 6px !important; }
          .inv-bank { grid-template-columns: 1fr !important; }
          .inv-toolbar button { padding: 6px 12px !important; font-size: 12px !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Toolbar — hidden in print */}
      <div className="no-print inv-toolbar" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: INK, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>Invoice — {order.order_number}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ padding: "8px 20px", background: TEAL, color: "#fff", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer" }}>Print / Save PDF</button>
          <button onClick={() => window.close()} style={{ padding: "8px 20px", background: "#555", color: "#fff", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer" }}>Close</button>
        </div>
      </div>

      {/* Invoice sheet */}
      <div className="inv-wrap" style={{ maxWidth: 800, margin: "72px auto 40px", background: "#fff", boxShadow: "0 2px 24px rgba(0,0,0,0.10)", display: "flex", flexDirection: "column", minHeight: 900 }}>
        <div className="inv-pad" style={{ padding: "44px 48px", flex: 1 }}>

          {/* Top — seller address (left) + logo/tagline (right) */}
          <div className="inv-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, marginBottom: 40 }}>
            <div style={{ fontSize: 11, color: TEAL, maxWidth: 320, lineHeight: 1.5, paddingTop: 24 }}>
              {store_name}{store_address ? `, ${store_address}` : ""}
            </div>
            <div style={{ textAlign: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt={store_name} style={{ height: 72, width: "auto", objectFit: "contain" }} />
              {inv?.tagline && <div style={{ fontSize: 13, color: TEAL, fontStyle: "italic", marginTop: 2 }}>« {inv.tagline} »</div>}
            </div>
          </div>

          {/* Bill To + meta */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 24, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: INK, marginBottom: 4 }}>BILL TO:</div>
              <div style={{ fontSize: 11, color: INK, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600 }}>{bill?.name || order.customer_name}</div>
                {(bill?.address_line_1) && <div>{bill.address_line_1}</div>}
                {bill?.address_line_2 && <div>{bill.address_line_2}</div>}
                <div>{[bill?.city, bill?.district, bill?.division, bill?.postal_code].filter(Boolean).join(", ")}</div>
                <div style={{ color: "#7a8584" }}>{bill?.phone || order.customer_phone}</div>
                {bill?.email && <div style={{ color: "#7a8584" }}>{bill.email}</div>}
              </div>
            </div>
            <div style={{ textAlign: "left", fontSize: 11 }}>
              <table style={{ borderSpacing: "8px 3px", borderCollapse: "separate" }}>
                <tbody>
                  <tr><td style={{ color: INK, fontWeight: 600 }}>Invoice number</td><td style={{ fontWeight: 700, color: INK }}>{order.order_number}</td></tr>
                  <tr><td style={{ color: INK, fontWeight: 600 }}>Issue date:</td><td style={{ fontWeight: 700, color: INK }}>{formatDate(order.created_at)}</td></tr>
                  <tr><td style={{ color: INK, fontWeight: 600 }}>Payment method:</td><td style={{ fontWeight: 700, color: INK, textTransform: "capitalize" }}>{order.payment_method}</td></tr>
                  <tr><td style={{ color: INK, fontWeight: 600 }}>Payment status:</td><td><span style={{ display: "inline-block", padding: "1px 7px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: order.payment_status === "paid" ? "#e6f4ec" : order.payment_status === "refunded" ? "#eef2ff" : "#fff5e6", color: order.payment_status === "paid" ? "#159A5c" : order.payment_status === "refunded" ? "#4338ca" : "#b45309" }}>{order.payment_status === "paid" ? "Paid" : order.payment_status === "refunded" ? "Refunded" : "Pending"}</span></td></tr>
                  {order.transaction_id && <tr><td style={{ color: INK, fontWeight: 600 }}>Txn ID:</td><td style={{ fontFamily: "monospace", fontSize: 10 }}>{order.transaction_id}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Teal banner — issue date + total */}
          <div className="inv-banner" style={{ display: "flex", borderRadius: 4, overflow: "hidden", marginBottom: 24 }}>
            <div style={{ flex: 1, background: TEAL, color: "#fff", padding: "12px 18px", borderRight: "1px solid rgba(255,255,255,0.2)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85 }}>Issue date</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{formatDate(order.created_at)}</div>
            </div>
            <div style={{ flex: 1, background: INK, color: "#fff", padding: "12px 18px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85 }}>Total due</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{formatCurrency(Number(order.total))}</div>
            </div>
          </div>

          {/* Items */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${TEAL}` }}>
                <th style={{ textAlign: "left", padding: "8px 4px", fontSize: 11, fontWeight: 700, color: INK }}>Description</th>
                <th style={{ textAlign: "center", padding: "8px 4px", fontSize: 11, fontWeight: 700, color: INK, width: 70 }}>Qty.</th>
                <th style={{ textAlign: "right", padding: "8px 4px", fontSize: 11, fontWeight: 700, color: INK, width: 110 }}>Unit price</th>
                <th style={{ textAlign: "right", padding: "8px 4px", fontSize: 11, fontWeight: 700, color: INK, width: 120 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #eef0ef" }}>
                  <td style={{ padding: "10px 4px", fontSize: 11, color: TEAL }}>
                    {item.product_name}{item.variant ? <span style={{ color: "#98a2a1" }}> — {item.variant}</span> : null}
                  </td>
                  <td style={{ padding: "10px 4px", textAlign: "center", fontSize: 11, color: INK }}>{item.quantity}</td>
                  <td style={{ padding: "10px 4px", textAlign: "right", fontSize: 11, color: INK }}>{formatCurrency(Number(item.unit_price))}</td>
                  <td style={{ padding: "10px 4px", textAlign: "right", fontSize: 11, color: INK }}>{formatCurrency(Number(item.total_price))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals — right aligned, no tax */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <div style={{ width: 260 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 4px", fontSize: 11, color: TEAL, borderBottom: "1px solid #eef0ef" }}>
                <span>Subtotal:</span><span>{formatCurrency(Number(order.subtotal))}</span>
              </div>
              {Number(order.shipping_cost) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 4px", fontSize: 11, color: TEAL, borderBottom: "1px solid #eef0ef" }}>
                  <span>Shipping:</span><span>{formatCurrency(Number(order.shipping_cost))}</span>
                </div>
              )}
              {Number(order.discount) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 4px", fontSize: 11, color: "#159A5c", borderBottom: "1px solid #eef0ef" }}>
                  <span>Discount:</span><span>-{formatCurrency(Number(order.discount))}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 4px", fontSize: 15, fontWeight: 800, color: INK }}>
                <span>Total:</span><span>{formatCurrency(Number(order.total))}</span>
              </div>
            </div>
          </div>

          {/* Signature */}
          {inv?.signature_image && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={inv.signature_image} alt="Signature" style={{ height: 80, width: "auto", objectFit: "contain", opacity: 0.9 }} />
            </div>
          )}

          {order.notes && (
            <div style={{ marginTop: 24, fontSize: 10, color: "#7a8584" }}>
              <span style={{ fontWeight: 700, color: INK }}>Notes: </span>{order.notes}
            </div>
          )}
        </div>

        {/* Footer band */}
        <div style={{ borderTop: `2px solid ${TEAL}`, padding: "16px 48px 28px" }}>
          {/* Contact row */}
          <div className="inv-foot" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 10, color: INK, paddingBottom: 12 }}>
            {store_phone && <span>☎ {store_phone}</span>}
            {(inv?.website) && <span>🌐 {inv.website}</span>}
            {store_email && <span>✉ {store_email}</span>}
          </div>
          {/* Two-column details */}
          <div className="inv-bank" style={{ display: "grid", gridTemplateColumns: hasBank ? "1fr 1fr" : "1fr", gap: 20, fontSize: 9.5, color: "#5a6564", lineHeight: 1.7 }}>
            <div>
              <div style={{ fontWeight: 700, color: INK }}>{store_name}</div>
              {store_address && <div>{store_address}</div>}
              {inv?.tax_reg_no && <div>Tax Reg No.: <b style={{ color: INK }}>{inv.tax_reg_no}</b></div>}
            </div>
            {hasBank && (
              <div>
                {bankRows.filter(([, v]) => v).map(([label, v]) => (
                  <div key={label}>{label}: <b style={{ color: INK }}>{v}</b></div>
                ))}
                {inv?.bank_address && <div>Bank address: <b style={{ color: INK }}>{inv.bank_address}</b></div>}
              </div>
            )}
          </div>
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
