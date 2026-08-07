// Branded HTML for transactional emails. Kept inline (no external CSS/images —
// email clients strip <style> and block many assets) using table-free, inline-
// styled markup that renders across Gmail/Outlook/Apple Mail. Palette matches
// the storefront (plum ink, pink, gold) but stays light-background for email.

const BRAND = {
  ink: "#3A2438",
  soft: "#6B5266",
  faint: "#9A8592",
  pink: "#BC4A72",
  gold: "#C79A42",
  line: "#EBD9E6",
  bg: "#FDF4F8",
  card: "#FFFFFF",
  // Savings/discount green. Deliberately a deep shade rather than a bright one:
  // it must stay readable on the white card in a client that ignores our styles.
  save: "#1F7A4D",
};

const taka = (n: number) => `৳${Math.round(Number(n) || 0).toLocaleString("en-BD")}`;

export interface EmailOrderItem {
  name: string;
  quantity: number;
  price: number; // unit price
}

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  total: number;
  paymentMethod: string;
  when: string;
  items: EmailOrderItem[];
  trackUrl: string;
  siteUrl: string;
  storeName: string;
  // Breakdown lines. All optional so existing callers (e.g. status emails, which
  // only know the total) keep working; each line is hidden when absent or zero,
  // so an order with no discount doesn't show an empty "Discount —" row.
  subtotal?: number;
  shipping?: number;
  discount?: number;
  tax?: number;
  couponCode?: string | null;
}

// Shared outer shell — header, body slot, footer. The header shows the ChineXa
// logo (absolute URL so email clients can load it); the store name is the alt
// text so it still reads correctly if a client blocks images.
function shell(storeName: string, siteUrl: string, bodyHtml: string): string {
  const logoUrl = `${siteUrl}/logo.png`;
  return `
  <div style="margin:0;padding:0;background:${BRAND.bg};">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
      <div style="text-align:center;padding:8px 0 20px;">
        <a href="${siteUrl}" style="text-decoration:none;">
          <img src="${logoUrl}" alt="${storeName}" height="48" style="height:48px;width:auto;max-width:220px;display:inline-block;border:0;outline:none;" />
        </a>
      </div>
      <div style="background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:16px;padding:28px 24px;">
        ${bodyHtml}
      </div>
      <p style="text-align:center;color:${BRAND.faint};font-size:12px;line-height:1.6;margin:20px 0 0;">
        You're receiving this because you placed an order at ${storeName}.<br>
        <a href="${siteUrl}" style="color:${BRAND.soft};text-decoration:none;">${siteUrl.replace(/^https?:\/\//, "")}</a>
      </p>
    </div>
  </div>`;
}

function itemsTable(items: EmailOrderItem[]): string {
  if (!items || items.length === 0) return "";
  const rows = items.map((it) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font-size:14px;color:${BRAND.ink};">
        ${escapeHtml(it.name)} <span style="color:${BRAND.faint};">× ${it.quantity}</span>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};font-size:14px;color:${BRAND.ink};text-align:right;white-space:nowrap;">
        ${taka(it.price * it.quantity)}
      </td>
    </tr>`).join("");
  return `<table role="presentation" width="100%" style="border-collapse:collapse;margin:16px 0;">${rows}</table>`;
}

function button(label: string, url: string): string {
  return `
  <div style="text-align:center;margin:24px 0 4px;">
    <a href="${url}" style="display:inline-block;background:${BRAND.pink};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:999px;">${label}</a>
  </div>`;
}

function escapeHtml(s: string): string {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// ── OTP verification code ──────────────────────────────────────────────────
export function otpEmail(code: string, storeName: string, siteUrl: string, purpose: string): { subject: string; html: string; text: string } {
  const action = purpose === "reset" ? "reset your password" : purpose === "login" ? "sign in" : "verify your account";
  const subject = `${code} is your ${storeName} verification code`;
  const body = `
    <p style="font-size:18px;font-weight:700;margin:0 0 8px;">Your verification code</p>
    <p style="font-size:14px;color:${BRAND.soft};margin:0 0 20px;line-height:1.6;">Use this code to ${escapeHtml(action)}. It expires in 5 minutes.</p>
    <div style="text-align:center;margin:8px 0 20px;">
      <span style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:8px;color:${BRAND.ink};background:${BRAND.bg};border:1px solid ${BRAND.line};border-radius:12px;padding:14px 24px;">${escapeHtml(code)}</span>
    </div>
    <p style="font-size:12px;color:${BRAND.faint};text-align:center;margin:0;line-height:1.6;">If you didn't request this, you can safely ignore this email.</p>`;
  return { subject, html: shell(storeName, siteUrl, body), text: `Your ${storeName} verification code is ${code}. It expires in 5 minutes.` };
}

// ── Order confirmation ─────────────────────────────────────────────────────
/**
 * Price breakdown: subtotal, shipping, discount, tax, then the grand total.
 *
 * Built as a <table>, not flex/grid — Outlook (Word rendering engine) and
 * several webmail clients drop `display:flex` entirely, which previously left
 * the total row's label and amount stacked instead of on one line.
 *
 * Rows are omitted when zero so a simple order stays a two-line summary, but
 * shipping is shown even at 0 (as "Free") because "was delivery actually free?"
 * is a question customers ask; silence there reads as an omission.
 */
function totalsTable(d: OrderEmailData): string {
  const row = (label: string, value: string, opts: { strong?: boolean; accent?: string } = {}) => `
    <tr>
      <td style="padding:5px 0;font-size:${opts.strong ? "15px" : "13px"};color:${opts.accent || (opts.strong ? BRAND.ink : BRAND.soft)};${opts.strong ? "font-weight:800;" : ""}">${label}</td>
      <td align="right" style="padding:5px 0;font-size:${opts.strong ? "15px" : "13px"};color:${opts.accent || (opts.strong ? BRAND.ink : BRAND.soft)};${opts.strong ? "font-weight:800;" : ""}white-space:nowrap;">${value}</td>
    </tr>`;

  const lines: string[] = [];
  if (typeof d.subtotal === "number" && d.subtotal > 0) lines.push(row("Subtotal", taka(d.subtotal)));
  if (typeof d.discount === "number" && d.discount > 0) {
    const label = d.couponCode ? `Discount (${escapeHtml(d.couponCode)})` : "Discount";
    lines.push(row(label, `− ${taka(d.discount)}`, { accent: BRAND.save }));
  }
  if (typeof d.shipping === "number") {
    lines.push(row("Delivery", d.shipping > 0 ? taka(d.shipping) : "Free"));
  }
  if (typeof d.tax === "number" && d.tax > 0) lines.push(row("Tax", taka(d.tax)));

  // With no breakdown supplied, fall back to just the total so the block never
  // renders as a lone grand-total row with a stray divider above it.
  const hasBreakdown = lines.length > 0;

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 0;">
      ${lines.join("")}
      ${hasBreakdown ? `<tr><td colspan="2" style="padding:6px 0 0;"><div style="border-top:2px solid ${BRAND.line};font-size:0;line-height:0;">&nbsp;</div></td></tr>` : ""}
      ${row("Total", taka(d.total), { strong: true })}
    </table>`;
}

/** Plain-text mirror of totalsTable, for clients that render only the text part. */
function totalsText(d: OrderEmailData, lead: string): string {
  const parts = [lead];
  if (typeof d.subtotal === "number" && d.subtotal > 0) parts.push(`Subtotal: ${taka(d.subtotal)}`);
  if (typeof d.discount === "number" && d.discount > 0) {
    parts.push(`Discount${d.couponCode ? ` (${d.couponCode})` : ""}: -${taka(d.discount)}`);
  }
  if (typeof d.shipping === "number") parts.push(`Delivery: ${d.shipping > 0 ? taka(d.shipping) : "Free"}`);
  if (typeof d.tax === "number" && d.tax > 0) parts.push(`Tax: ${taka(d.tax)}`);
  parts.push(`Total: ${taka(d.total)} (${d.paymentMethod})`);
  parts.push(`Track: ${d.trackUrl}`);
  return parts.join("\n");
}

export function orderConfirmationEmail(d: OrderEmailData): { subject: string; html: string; text: string } {
  const subject = `Order ${d.orderNumber} confirmed — ${d.storeName}`;
  const body = `
    <p style="font-size:18px;font-weight:700;margin:0 0 4px;">Thank you, ${escapeHtml(d.customerName || "there")}! 🌸</p>
    <p style="font-size:14px;color:${BRAND.soft};margin:0 0 20px;line-height:1.6;">Your order has been placed successfully. Here's a summary:</p>
    <div style="background:${BRAND.bg};border-radius:12px;padding:14px 16px;font-size:13px;color:${BRAND.soft};line-height:1.9;">
      <div><strong style="color:${BRAND.ink};">Order:</strong> ${escapeHtml(d.orderNumber)}</div>
      <div><strong style="color:${BRAND.ink};">Placed:</strong> ${escapeHtml(d.when)}</div>
      <div><strong style="color:${BRAND.ink};">Payment:</strong> ${escapeHtml(d.paymentMethod)}</div>
    </div>
    ${itemsTable(d.items)}
    ${totalsTable(d)}
    ${button("Track your order", d.trackUrl)}
    <p style="font-size:12px;color:${BRAND.faint};text-align:center;margin:16px 0 0;line-height:1.6;">We'll email you when your order ships. Questions? Just reply to this email.</p>`;
  return { subject, html: shell(d.storeName, d.siteUrl, body), text: totalsText(d, `Order ${d.orderNumber} confirmed.`) };
}

// ── Status update (shipped / delivered / etc.) ─────────────────────────────
export function orderStatusEmail(
  d: OrderEmailData,
  status: { title: string; message: string },
): { subject: string; html: string; text: string } {
  const subject = `${status.title} — Order ${d.orderNumber}`;
  const body = `
    <p style="font-size:18px;font-weight:700;margin:0 0 4px;">${escapeHtml(status.title)}</p>
    <p style="font-size:14px;color:${BRAND.soft};margin:0 0 20px;line-height:1.6;">${escapeHtml(status.message)}</p>
    <div style="background:${BRAND.bg};border-radius:12px;padding:14px 16px;font-size:13px;color:${BRAND.soft};line-height:1.9;">
      <div><strong style="color:${BRAND.ink};">Order:</strong> ${escapeHtml(d.orderNumber)}</div>
      <div><strong style="color:${BRAND.ink};">Total:</strong> ${taka(d.total)}</div>
    </div>
    ${button("Track your order", d.trackUrl)}`;
  return { subject, html: shell(d.storeName, d.siteUrl, body), text: `${status.title}. Order ${d.orderNumber}. Track: ${d.trackUrl}` };
}

// ── Admin new-order alert ──────────────────────────────────────────────────
export function adminOrderEmail(d: OrderEmailData & { customerPhone: string; tierName: string }): { subject: string; html: string; text: string } {
  const subject = `New order ${d.orderNumber} — ${taka(d.total)}`;
  const body = `
    <p style="font-size:18px;font-weight:700;margin:0 0 16px;">New order received</p>
    <div style="background:${BRAND.bg};border-radius:12px;padding:14px 16px;font-size:13px;color:${BRAND.soft};line-height:1.9;">
      <div><strong style="color:${BRAND.ink};">Order:</strong> ${escapeHtml(d.orderNumber)}</div>
      <div><strong style="color:${BRAND.ink};">Amount:</strong> ${taka(d.total)} (${escapeHtml(d.paymentMethod)})</div>
      <div><strong style="color:${BRAND.ink};">When:</strong> ${escapeHtml(d.when)}</div>
      <div><strong style="color:${BRAND.ink};">Customer:</strong> ${escapeHtml(d.customerName)} [${escapeHtml(d.tierName)}]</div>
      <div><strong style="color:${BRAND.ink};">Phone:</strong> ${escapeHtml(d.customerPhone)}</div>
    </div>
    ${itemsTable(d.items)}
    ${totalsTable(d)}
    ${button("Open admin", `${d.siteUrl}/admin/orders`)}`;
  return {
    subject,
    html: shell(d.storeName, d.siteUrl, body),
    text: `${totalsText(d, `New order ${d.orderNumber}.`)}\n${d.customerName} [${d.tierName}], ${d.customerPhone}`,
  };
}
