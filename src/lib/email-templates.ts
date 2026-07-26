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
}

// Shared outer shell — header, body slot, footer.
function shell(storeName: string, siteUrl: string, bodyHtml: string): string {
  return `
  <div style="margin:0;padding:0;background:${BRAND.bg};">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
      <div style="text-align:center;padding:8px 0 20px;">
        <a href="${siteUrl}" style="font-size:24px;font-weight:800;letter-spacing:0.5px;color:${BRAND.ink};text-decoration:none;">${storeName}</a>
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

// ── Order confirmation ─────────────────────────────────────────────────────
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
    <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:${BRAND.ink};padding-top:8px;border-top:2px solid ${BRAND.line};">
      <span>Total</span><span style="float:right;">${taka(d.total)}</span>
    </div>
    ${button("Track your order", d.trackUrl)}
    <p style="font-size:12px;color:${BRAND.faint};text-align:center;margin:16px 0 0;line-height:1.6;">We'll email you when your order ships. Questions? Just reply to this email.</p>`;
  return { subject, html: shell(d.storeName, d.siteUrl, body), text: `Order ${d.orderNumber} confirmed. Total ${taka(d.total)} (${d.paymentMethod}). Track: ${d.trackUrl}` };
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
    ${button("Open admin", `${d.siteUrl}/admin/orders`)}`;
  return { subject, html: shell(d.storeName, d.siteUrl, body), text: `New order ${d.orderNumber} — ${taka(d.total)} (${d.paymentMethod}). ${d.customerName} [${d.tierName}], ${d.customerPhone}` };
}
