"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Link2, Plus, Copy, Check, QrCode, Send, Mail, Ban, Trash2, Clock,
  CheckCircle2, XCircle, RefreshCw, ExternalLink, AlertTriangle,
} from "lucide-react";
import QRCodeLib from "qrcode";
import { Card, CardContent } from "@/components/ui/card";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, cn } from "@/lib/utils";
import { useAdmin } from "@/contexts/admin-context";

interface PaymentLink {
  id: string;
  token: string;
  url: string;
  order_id: string;
  order_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  amount: string | number;
  description: string | null;
  status: "active" | "paid" | "expired" | "revoked";
  expires_at: string;
  sent_via: string | null;
  sent_to: string | null;
  opened_at: string | null;
  paid_at: string | null;
  created_at: string;
  created_by_name: string | null;
  payment_status: string;
}

const EXPIRY_CHOICES = [
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
];

const STATUS_STYLES: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  active: { label: "Active", className: "bg-secondary/10 text-secondary", icon: Clock },
  paid: { label: "Paid", className: "bg-success/10 text-success", icon: CheckCircle2 },
  expired: { label: "Expired", className: "bg-warning/10 text-warning", icon: Clock },
  revoked: { label: "Revoked", className: "bg-border/50 text-charcoal-lighter", icon: XCircle },
};

function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export default function PaymentLinksPage() {
  const { can } = useAdmin();
  const canAdd = can("accounting", "add");
  const canEdit = can("accounting", "edit");
  const canDelete = can("accounting", "delete");

  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState({ sms: false, email: false });
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<{ url: string; order: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/payment-links", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setBanner({ tone: "err", text: json.error || "Could not load payment links" });
        return;
      }
      setLinks(json.links || []);
      setChannels(json.channels || { sms: false, email: false });
    } catch {
      setBanner({ tone: "err", text: "Could not reach the server" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Render the QR locally — no external image service, so a payment URL is
  // never sent to a third party just to draw a square.
  useEffect(() => {
    if (!qrFor) return;
    QRCodeLib.toDataURL(qrFor.url, { width: 320, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [qrFor]);

  const copy = async (link: PaymentLink) => {
    try {
      await navigator.clipboard.writeText(link.url);
    } catch {
      // Clipboard API needs a secure context; fall back so copy still works.
      const ta = document.createElement("textarea");
      ta.value = link.url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedId(link.id);
    setTimeout(() => setCopiedId((c) => (c === link.id ? null : c)), 2000);
  };

  const act = async (id: string, body: Record<string, unknown>, okText: string) => {
    try {
      const res = await fetch(`/api/payment-links/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setBanner({ tone: "err", text: json.error || "Action failed" });
        return;
      }
      setBanner({ tone: "ok", text: okText });
      void load();
    } catch {
      setBanner({ tone: "err", text: "Could not reach the server" });
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this payment link? The customer will no longer be able to use it.")) return;
    try {
      const res = await fetch(`/api/payment-links/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setBanner({ tone: "err", text: json.error || "Could not delete" });
        return;
      }
      setBanner({ tone: "ok", text: "Payment link deleted" });
      void load();
    } catch {
      setBanner({ tone: "err", text: "Could not reach the server" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-charcoal flex items-center gap-2">
            <Link2 className="h-6 w-6 text-secondary" />
            Payment Links
          </h1>
          <p className="text-sm text-charcoal-lighter mt-1">
            Create a secure link for any amount and send it to a customer — no account needed on their side.
          </p>
        </div>
        <div className="flex gap-2">
          <AdminButton variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </AdminButton>
          {canAdd && (
            <AdminButton onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Create Payment Link
            </AdminButton>
          )}
        </div>
      </div>

      {banner && (
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-sm flex items-start justify-between gap-3",
            banner.tone === "ok" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}
        >
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} className="shrink-0 opacity-70 hover:opacity-100">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : links.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No payment links yet"
          description="Create a link with a custom amount and share it over Messenger, WhatsApp or SMS."
        />
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const st = STATUS_STYLES[link.status] || STATUS_STYLES.revoked;
            const StIcon = st.icon;
            const isActive = link.status === "active";
            return (
              <Card key={link.id} className="overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-heading text-lg font-bold text-charcoal tabular-nums">
                          {formatCurrency(Number(link.amount))}
                        </span>
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", st.className)}>
                          <StIcon className="h-3 w-3" />
                          {st.label}
                        </span>
                        {isActive && (
                          <span className="text-[11px] text-charcoal-lighter">{timeLeft(link.expires_at)}</span>
                        )}
                      </div>
                      <p className="text-sm text-charcoal truncate">
                        {link.customer_name || "—"}
                        {link.customer_phone ? ` · ${link.customer_phone}` : ""}
                      </p>
                      <p className="text-xs text-charcoal-lighter truncate">
                        {link.order_number}
                        {link.description ? ` · ${link.description}` : ""}
                        {link.opened_at ? " · opened" : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <AdminButton size="xs" variant="outline" onClick={() => void copy(link)}>
                        {copiedId === link.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1 text-success" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1" /> Copy link
                          </>
                        )}
                      </AdminButton>
                      <AdminButton
                        size="xs"
                        variant="ghost"
                        onClick={() => setQrFor({ url: link.url, order: link.order_number })}
                        title="Show QR code"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                      </AdminButton>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" title="Open link">
                        <AdminButton size="xs" variant="ghost">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </AdminButton>
                      </a>
                      {isActive && canEdit && channels.sms && (
                        <AdminButton
                          size="xs"
                          variant="ghost"
                          title="Resend by SMS"
                          onClick={() => {
                            const to = prompt("Send this link by SMS to which number?", link.customer_phone || "");
                            if (to) void act(link.id, { action: "resend", via: "sms", to }, "SMS sent");
                          }}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </AdminButton>
                      )}
                      {isActive && canEdit && channels.email && (
                        <AdminButton
                          size="xs"
                          variant="ghost"
                          title="Resend by email"
                          onClick={() => {
                            const to = prompt("Send this link by email to which address?", "");
                            if (to) void act(link.id, { action: "resend", via: "email", to }, "Email sent");
                          }}
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </AdminButton>
                      )}
                      {isActive && canEdit && (
                        <AdminButton
                          size="xs"
                          variant="ghost"
                          title="Revoke this link"
                          onClick={() => {
                            if (confirm("Revoke this link? The customer will no longer be able to pay with it.")) {
                              void act(link.id, { action: "revoke" }, "Link revoked");
                            }
                          }}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </AdminButton>
                      )}
                      {link.status !== "paid" && canDelete && (
                        <AdminButton size="xs" variant="ghost" title="Delete" onClick={() => void remove(link.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </AdminButton>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateLinkDialog
          channels={channels}
          onClose={() => setShowCreate(false)}
          onCreated={(msg) => {
            setBanner({ tone: "ok", text: msg });
            void load();
          }}
        />
      )}

      {qrFor && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => {
            setQrFor(null);
            setQrDataUrl("");
          }}
        >
          <div className="bg-card rounded-2xl p-6 max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading font-bold text-charcoal mb-1">Scan to pay</h3>
            <p className="text-xs text-charcoal-lighter mb-4">{qrFor.order}</p>
            {qrDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={qrDataUrl} alt="Payment QR code" className="w-full rounded-lg" />
            ) : (
              <Skeleton className="h-64 w-full rounded-lg" />
            )}
            <AdminButton
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              onClick={() => {
                setQrFor(null);
                setQrDataUrl("");
              }}
            >
              Close
            </AdminButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateLinkDialog({
  channels,
  onClose,
  onCreated,
}: {
  channels: { sms: boolean; email: boolean };
  onClose: () => void;
  onCreated: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState(24);
  const [sendSms, setSendSms] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [smsTo, setSmsTo] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ url: string; amount: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    setError(null);
    const amt = Number(amount);
    if (!name.trim()) return setError("Customer name is required");
    if (!phone.trim()) return setError("Customer phone is required");
    if (!Number.isFinite(amt) || amt <= 0) return setError("Enter an amount greater than zero");
    if (sendSms && !smsTo.trim()) return setError("Enter the phone number to send the SMS to");
    if (sendEmail && !emailTo.trim()) return setError("Enter the email address to send to");

    setSaving(true);
    try {
      const via: string[] = [];
      if (sendSms) via.push("sms");
      if (sendEmail) via.push("email");

      const res = await fetch("/api/payment-links/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          amount: amt,
          description: description.trim(),
          expires_in_hours: hours,
          send_via: via,
          send_to_phone: sendSms ? smsTo.trim() : "",
          send_to_email: sendEmail ? emailTo.trim() : "",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not create the payment link");
        return;
      }
      // Stay open and show the link so it can be copied immediately — closing
      // straight away would hide the one thing the admin came here for.
      setCreated({ url: json.url, amount: json.amount });
      const failed = (json.delivery || []).filter((d: { ok: boolean }) => !d.ok);
      onCreated(
        failed.length
          ? `Link created, but ${failed.map((f: { channel: string }) => f.channel).join(" & ")} failed to send. You can still copy it.`
          : "Payment link created"
      );
    } catch {
      setError("Could not reach the server");
    } finally {
      setSaving(false);
    }
  };

  const copyCreated = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = created.url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputCls =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-charcoal placeholder:text-charcoal-lighter/60 focus:outline-none focus:ring-2 focus:ring-secondary/30";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl w-full max-w-md my-8">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-heading text-lg font-bold text-charcoal">
            {created ? "Payment Link Ready" : "Create Payment Link"}
          </h2>
        </div>

        {created ? (
          <div className="p-5 space-y-4">
            <div className="text-center">
              <p className="text-xs text-charcoal-lighter mb-1">Amount</p>
              <p className="font-heading text-3xl font-bold text-charcoal">{formatCurrency(created.amount)}</p>
            </div>
            <div className="rounded-lg bg-pearl border border-border p-3">
              <p className="text-xs text-charcoal-lighter mb-1">Payment link</p>
              <p className="text-xs text-charcoal break-all font-mono">{created.url}</p>
            </div>
            <AdminButton className="w-full" onClick={() => void copyCreated()}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1.5" /> Copied to clipboard
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1.5" /> Copy link
                </>
              )}
            </AdminButton>
            <AdminButton variant="outline" className="w-full" onClick={onClose}>
              Done
            </AdminButton>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Customer name *</label>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Customer phone *</label>
                <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Amount (BDT) *</label>
                <input
                  className={inputCls}
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">What is this for?</label>
                <input
                  className={inputCls}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Facebook order — 2 serums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Link expires in</label>
                <div className="flex gap-2">
                  {EXPIRY_CHOICES.map((c) => (
                    <button
                      key={c.hours}
                      type="button"
                      onClick={() => setHours(c.hours)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                        hours === c.hours
                          ? "border-secondary bg-secondary/10 text-secondary"
                          : "border-border text-charcoal-lighter hover:bg-pearl"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-xs font-medium text-charcoal">Send it now (optional)</p>
                <p className="text-[11px] text-charcoal-lighter -mt-2">
                  You can always just copy the link and paste it into Messenger or WhatsApp.
                </p>

                <label className={cn("flex items-center gap-2 text-xs", !channels.sms && "opacity-50")}>
                  <input
                    type="checkbox"
                    checked={sendSms}
                    disabled={!channels.sms}
                    onChange={(e) => setSendSms(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-charcoal">Send by SMS</span>
                  {!channels.sms && <span className="text-charcoal-lighter">(not configured)</span>}
                </label>
                {sendSms && (
                  <input
                    className={inputCls}
                    value={smsTo}
                    onChange={(e) => setSmsTo(e.target.value)}
                    placeholder="Phone number for SMS"
                  />
                )}

                <label className={cn("flex items-center gap-2 text-xs", !channels.email && "opacity-50")}>
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    disabled={!channels.email}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-charcoal">Send by email</span>
                  {!channels.email && <span className="text-charcoal-lighter">(not configured)</span>}
                </label>
                {sendEmail && (
                  <input
                    className={inputCls}
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="Email address"
                  />
                )}
              </div>

              {error && (
                <p className="text-xs text-destructive flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                  {error}
                </p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
              <AdminButton variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </AdminButton>
              <AdminButton onClick={() => void submit()} disabled={saving}>
                {saving ? "Creating…" : "Create link"}
              </AdminButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
