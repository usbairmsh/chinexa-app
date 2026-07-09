"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Users, Wallet, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

interface Partner {
  id: string; name: string; email: string | null; phone: string | null;
  initial_investment: number; share_percentage: number; join_date: string;
  is_active: boolean; notes: string | null; current_equity: number;
}
interface PartnerTransaction {
  id: string; partner_id: string; partner_name: string; type: "investment" | "withdrawal" | "profit_distribution";
  amount: number; transaction_date: string; note: string | null;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TYPE_LABELS: Record<PartnerTransaction["type"], string> = {
  investment: "Investment", withdrawal: "Withdrawal", profit_distribution: "Profit Distribution",
};

export function PartnersTab() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [initialInvestment, setInitialInvestment] = useState("");
  const [sharePercentage, setSharePercentage] = useState("");
  const [joinDate, setJoinDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [txnPartnerId, setTxnPartnerId] = useState("");
  const [txnType, setTxnType] = useState<PartnerTransaction["type"]>("investment");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10));
  const [txnNote, setTxnNote] = useState("");
  const [txnSaving, setTxnSaving] = useState(false);
  const [txnError, setTxnError] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        fetch("/api/accounting/partners"),
        fetch("/api/accounting/partner-transactions"),
      ]);
      const pJson = await pRes.json();
      const tJson = await tRes.json();
      setPartners(pJson.data || []);
      setTransactions(tJson.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAddPartner = () => {
    setName(""); setEmail(""); setPhone(""); setInitialInvestment(""); setSharePercentage("");
    setJoinDate(new Date().toISOString().slice(0, 10)); setNotes(""); setFormError("");
    setPartnerDialogOpen(true);
  };

  const handleSavePartner = async () => {
    if (!name.trim()) { setFormError("Partner name is required"); return; }
    const pct = Number(sharePercentage);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) { setFormError("Share percentage must be between 0 and 100"); return; }
    if (!joinDate) { setFormError("Join date is required"); return; }
    setFormError("");
    setSaving(true);
    try {
      const res = await fetch("/api/accounting/partners", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), email: email || null, phone: phone || null,
          initial_investment: Number(initialInvestment) || 0, share_percentage: pct, join_date: joinDate, notes: notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setFormError(json?.error || "Failed to add partner"); return; }
      setPartnerDialogOpen(false);
      fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const openAddTransaction = (partnerId?: string) => {
    setTxnPartnerId(partnerId || partners[0]?.id || "");
    setTxnType("investment");
    setTxnAmount("");
    setTxnDate(new Date().toISOString().slice(0, 10));
    setTxnNote("");
    setTxnError("");
    setTxnDialogOpen(true);
  };

  const handleSaveTransaction = async () => {
    if (!txnPartnerId) { setTxnError("Select a partner"); return; }
    if (!txnAmount || Number(txnAmount) <= 0) { setTxnError("Amount must be positive"); return; }
    if (!txnDate) { setTxnError("Transaction date is required"); return; }
    setTxnError("");
    setTxnSaving(true);
    try {
      const res = await fetch("/api/accounting/partner-transactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_id: txnPartnerId, type: txnType, amount: Number(txnAmount), transaction_date: txnDate, note: txnNote || null }),
      });
      const json = await res.json();
      if (!res.ok) { setTxnError(json?.error || "Failed to record transaction"); return; }
      setTxnDialogOpen(false);
      fetchAll();
    } finally {
      setTxnSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <AdminButton variant="outline" onClick={() => openAddTransaction()} disabled={partners.length === 0}>
          <Wallet className="h-4 w-4 mr-1" /> Record Transaction
        </AdminButton>
        <AdminButton onClick={openAddPartner}>
          <Plus className="h-4 w-4 mr-1" /> Add Partner
        </AdminButton>
      </div>

      {partners.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-charcoal-lighter">No partners added yet.</CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {partners.map((p) => (
            <Card key={p.id} className={!p.is_active ? "opacity-60" : ""}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-secondary" /> {p.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal-lighter">Share</span>
                  <span className="font-medium text-charcoal">{p.share_percentage}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal-lighter">Initial Investment</span>
                  <span className="font-medium text-charcoal">{formatCurrency(p.initial_investment)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal-lighter">Current Equity</span>
                  <span className="font-bold text-secondary">{formatCurrency(p.current_equity)}</span>
                </div>
                <div className="flex justify-between text-xs text-charcoal-lighter pt-1 border-t border-border/30 mt-2">
                  <span>Joined {formatDate(p.join_date)}</span>
                  <button onClick={() => openAddTransaction(p.id)} className="text-secondary hover:underline">+ Transaction</button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><History className="h-4 w-4 text-secondary" /> Transaction History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="text-sm text-charcoal-lighter py-6 text-center">No partner transactions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-left">
                    <th className="px-4 py-3 font-medium text-charcoal-lighter">Partner</th>
                    <th className="px-4 py-3 font-medium text-charcoal-lighter">Type</th>
                    <th className="px-4 py-3 font-medium text-charcoal-lighter hidden md:table-cell">Date</th>
                    <th className="px-4 py-3 font-medium text-charcoal-lighter text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b border-border/20 hover:bg-pearl/50">
                      <td className="px-4 py-3 text-charcoal">{t.partner_name}</td>
                      <td className="px-4 py-3 text-charcoal-lighter">{TYPE_LABELS[t.type]}</td>
                      <td className="px-4 py-3 text-charcoal-lighter hidden md:table-cell">{formatDate(t.transaction_date)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${t.type === "investment" ? "text-success" : "text-destructive"}`}>
                        {t.type === "investment" ? "+" : "-"}{formatCurrency(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Partner Dialog */}
      <Dialog open={partnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Partner</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input label="Partner Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Initial Investment (৳)" type="number" value={initialInvestment} onChange={(e) => setInitialInvestment(e.target.value)} placeholder="100000" />
              <Input label="Share Percentage (%)" type="number" value={sharePercentage} onChange={(e) => setSharePercentage(e.target.value)} placeholder="25" />
            </div>
            <Input label="Join Date" type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
            <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px]" />
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setPartnerDialogOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={handleSavePartner} disabled={saving}>{saving ? "Saving..." : "Save"}</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Transaction Dialog */}
      <Dialog open={txnDialogOpen} onOpenChange={setTxnDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Partner Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Partner</label>
              <Select value={txnPartnerId} onValueChange={setTxnPartnerId}>
                <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
                <SelectContent>
                  {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Type</label>
              <Select value={txnType} onValueChange={(v) => setTxnType(v as PartnerTransaction["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="investment">Investment</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  <SelectItem value="profit_distribution">Profit Distribution</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Amount (৳)" type="number" value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} placeholder="50000" />
              <Input label="Date" type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
            </div>
            <Textarea label="Note (optional)" value={txnNote} onChange={(e) => setTxnNote(e.target.value)} className="min-h-[60px]" />
            {txnError && <p className="text-sm text-destructive">{txnError}</p>}
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setTxnDialogOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={handleSaveTransaction} disabled={txnSaving}>{txnSaving ? "Saving..." : "Save"}</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
