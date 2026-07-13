"use client";

import { useState, useEffect } from "react";
import { Bell, Send, Users, Crown, Globe, Search, Check, Loader2, Tag, Gift, Package, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateShort, cn, collectMissingFields } from "@/lib/utils";
import { useAdmin } from "@/contexts/admin-context";

type Audience = "all" | "tiers" | "customers";
type NotifType = "promo" | "loyalty" | "order" | "system";

interface Broadcast {
  id: string;
  title: string;
  message: string;
  type: string;
  audience: string;
  audience_detail: string | null;
  recipient_count: number;
  created_at: string;
}

const typeConfig: Record<string, { label: string; icon: typeof Bell; color: string }> = {
  promo: { label: "Promotion", icon: Tag, color: "bg-pink-50 text-pink-600" },
  loyalty: { label: "Loyalty", icon: Gift, color: "bg-amber-50 text-amber-600" },
  order: { label: "Order", icon: Package, color: "bg-blue-50 text-blue-600" },
  system: { label: "System", icon: Bell, color: "bg-pearl text-charcoal-lighter" },
};

export default function AdminNotificationsPage() {
  const { can } = useAdmin();
  const canSendBroadcast = can("customers", "add");
  // Composer state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NotifType>("promo");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<Audience>("all");

  // Tier selection
  const [tiers, setTiers] = useState<{ id: string; name: string; color?: string }[]>([]);
  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);

  // Customer selection
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<{ id: string; name: string }[]>([]);

  // Sending + history
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/notifications/send");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setHistory(data);
    } catch {} finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    fetchHistory();
    fetch("/api/membership/tiers")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTiers(data); })
      .catch(() => {});
  }, []);

  const handleCustomerSearch = async (q: string) => {
    setCustomerSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}&page_size=10`);
      const data = await res.json();
      if (res.ok && Array.isArray(data?.data)) setSearchResults(data.data);
    } catch {} finally { setSearchLoading(false); }
  };

  const toggleTier = (id: string) => {
    setSelectedTiers((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  const toggleCustomer = (cust: { id: string; name: string }) => {
    setSelectedCustomers((prev) =>
      prev.find((c) => c.id === cust.id) ? prev.filter((c) => c.id !== cust.id) : [...prev, cust]
    );
  };

  const canSend =
    canSendBroadcast &&
    title.trim() &&
    message.trim() &&
    (audience === "all" ||
      (audience === "tiers" && selectedTiers.length > 0) ||
      (audience === "customers" && selectedCustomers.length > 0));

  const handleSend = async () => {
    if (sending) return;
    const missing = collectMissingFields([
      { label: "Title", value: title },
      { label: "Message", value: message },
    ]);
    if (missing) { setError(missing); return; }
    if (!canSend) return;
    setSending(true);
    setError("");
    setSentMessage("");
    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          type,
          link: link.trim() || null,
          audience,
          tier_ids: audience === "tiers" ? selectedTiers : undefined,
          customer_ids: audience === "customers" ? selectedCustomers.map((c) => c.id) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Failed to send (${res.status})`);
        return;
      }
      setSentMessage(`Notification sent to ${data.sent} customer${data.sent > 1 ? "s" : ""}!`);
      setTitle(""); setMessage(""); setLink("");
      setSelectedTiers([]); setSelectedCustomers([]); setCustomerSearch(""); setSearchResults([]);
      fetchHistory();
      setTimeout(() => setSentMessage(""), 4000);
    } catch {
      setError("Network error — notification not sent");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-charcoal">Push Notifications</h1>
        <p className="text-sm text-charcoal-lighter">Send notifications to all customers, specific tiers, or individual customers</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* ═══ Composer ═══ */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Send className="h-4 w-4" /> Compose Notification</CardTitle>
            <CardDescription>Delivered instantly to the customer&apos;s notification inbox</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Title" required placeholder="e.g., Flash Sale — 24 hours only!" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea label="Message" required placeholder="Write the notification message..." value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[80px]" />
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-1.5">Type</label>
                <Select value={type} onValueChange={(v) => setType(v as NotifType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="promo"><span className="flex items-center gap-2"><Tag className="h-3.5 w-3.5" /> Promotion</span></SelectItem>
                    <SelectItem value="loyalty"><span className="flex items-center gap-2"><Gift className="h-3.5 w-3.5" /> Loyalty</span></SelectItem>
                    <SelectItem value="order"><span className="flex items-center gap-2"><Package className="h-3.5 w-3.5" /> Order</span></SelectItem>
                    <SelectItem value="system"><span className="flex items-center gap-2"><Bell className="h-3.5 w-3.5" /> System</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input label="Link (optional)" placeholder="/products or /cart" value={link} onChange={(e) => setLink(e.target.value)} />
            </div>

            {/* Audience */}
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Send To</label>
              <div className="flex flex-col sm:flex-row gap-2">
                {([
                  { key: "all", label: "All Customers", icon: Globe },
                  { key: "tiers", label: "By Tier", icon: Crown },
                  { key: "customers", label: "Specific Customers", icon: Users },
                ] as { key: Audience; label: string; icon: typeof Globe }[]).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setAudience(opt.key)}
                    className={cn(
                      "sm:flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium border transition-all",
                      audience === opt.key ? "border-secondary bg-secondary/10 text-secondary" : "border-border/30 text-charcoal-lighter hover:bg-pearl"
                    )}
                  >
                    <opt.icon className="h-3.5 w-3.5" /> {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tier picker */}
            {audience === "tiers" && (
              <div className="space-y-2">
                {tiers.length === 0 ? (
                  <p className="text-xs text-charcoal-lighter">No membership tiers found.</p>
                ) : tiers.map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => toggleTier(tier.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                      selectedTiers.includes(tier.id) ? "border-secondary bg-secondary/5" : "border-border/30 hover:bg-pearl/50"
                    )}
                  >
                    <Badge className={cn("text-[10px]", tier.color)}>{tier.name}</Badge>
                    <span className="text-xs text-charcoal-lighter">All {tier.name} members</span>
                    {selectedTiers.includes(tier.id) && <Check className="h-4 w-4 text-secondary ml-auto" />}
                  </button>
                ))}
              </div>
            )}

            {/* Customer picker */}
            {audience === "customers" && (
              <div className="space-y-2">
                {selectedCustomers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCustomers.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary text-[11px] font-medium">
                        {c.name}
                        <button type="button" onClick={() => toggleCustomer(c)} className="hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 rounded-xl border border-border bg-pearl/30">
                  <Search className="h-3.5 w-3.5 text-charcoal-lighter shrink-0" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => handleCustomerSearch(e.target.value)}
                    placeholder="Search by name or phone number..."
                    className="w-full py-2.5 text-sm bg-transparent outline-none text-charcoal placeholder:text-charcoal-lighter/50"
                  />
                  {searchLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-charcoal-lighter shrink-0" />}
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border border-border/30 rounded-xl bg-white">
                    {searchResults.map((cust) => {
                      const isSelected = selectedCustomers.some((c) => c.id === cust.id);
                      return (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => toggleCustomer({ id: cust.id, name: cust.name })}
                          className={cn("w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-pearl transition-colors", isSelected && "bg-secondary/5")}
                        >
                          <div>
                            <p className="text-xs font-medium text-charcoal">{cust.name}</p>
                            <p className="text-[10px] text-charcoal-lighter">{cust.phone}</p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-secondary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>}
            {sentMessage && <p className="text-xs text-success bg-success/5 border border-success/20 rounded-lg px-3 py-2 flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> {sentMessage}</p>}

            <AdminButton onClick={handleSend} disabled={sending || !canSend}>
              {sending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
              {sending ? "Sending..." : "Send Notification"}
            </AdminButton>
          </CardContent>
        </Card>

        {/* ═══ History ═══ */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Bell className="h-4 w-4" /> Sent History</CardTitle>
            <CardDescription>Recent broadcasts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[620px] overflow-y-auto">
            {historyLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
            ) : history.length === 0 ? (
              <p className="text-sm text-charcoal-lighter text-center py-8">No notifications sent yet.</p>
            ) : (
              history.map((b) => {
                const config = typeConfig[b.type] || typeConfig.system;
                const Icon = config.icon;
                return (
                  <div key={b.id} className="rounded-xl border border-border/20 p-3 flex gap-3">
                    <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0", config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">{b.title}</p>
                      <p className="text-xs text-charcoal-lighter line-clamp-2 mt-0.5">{b.message}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-charcoal-lighter">
                        <span className="capitalize">{b.audience_detail || b.audience}</span>
                        <span>·</span>
                        <span>{b.recipient_count} recipient{b.recipient_count !== 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>{formatDateShort(b.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
