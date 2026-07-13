"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Landmark, Wallet, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, cn } from "@/lib/utils";
import { useAdmin } from "@/contexts/admin-context";

interface Loan {
  id: string; lender_name: string; lender_type: "bank" | "company" | "person";
  principal: number; interest_rate: number; repayment_type: "installment" | "profit_based" | "mixed";
  start_date: string; is_active: boolean; notes: string | null;
  principal_paid: number; interest_paid: number; due_amount: number;
}
interface LoanRepayment {
  id: string; loan_id: string; lender_name: string; type: "principal" | "interest";
  amount: number; repayment_date: string; note: string | null;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const LENDER_TYPE_LABELS: Record<Loan["lender_type"], string> = { bank: "Bank", company: "Company", person: "Person" };
const REPAYMENT_TYPE_LABELS: Record<Loan["repayment_type"], string> = { installment: "Installment", profit_based: "Profit-based", mixed: "Mixed" };
const REPAYMENT_KIND_LABELS: Record<LoanRepayment["type"], string> = { principal: "Principal", interest: "Interest" };

export function LoansTab() {
  const { can } = useAdmin();
  const canAdd = can("accounting", "add");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<LoanRepayment[]>([]);
  const [loading, setLoading] = useState(true);

  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [lenderName, setLenderName] = useState("");
  const [lenderType, setLenderType] = useState<Loan["lender_type"]>("bank");
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [repaymentType, setRepaymentType] = useState<Loan["repayment_type"]>("installment");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [repayDialogOpen, setRepayDialogOpen] = useState(false);
  const [repayLoanId, setRepayLoanId] = useState("");
  const [repayType, setRepayType] = useState<LoanRepayment["type"]>("principal");
  const [repayAmount, setRepayAmount] = useState("");
  const [repayDate, setRepayDate] = useState(new Date().toISOString().slice(0, 10));
  const [repayNote, setRepayNote] = useState("");
  const [repaySaving, setRepaySaving] = useState(false);
  const [repayError, setRepayError] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, rRes] = await Promise.all([
        fetch("/api/accounting/loans"),
        fetch("/api/accounting/loan-repayments"),
      ]);
      const lJson = await lRes.json();
      const rJson = await rRes.json();
      setLoans(lJson.data || []);
      setRepayments(rJson.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAddLoan = () => {
    setLenderName(""); setLenderType("bank"); setPrincipal(""); setInterestRate("");
    setRepaymentType("installment"); setStartDate(new Date().toISOString().slice(0, 10));
    setNotes(""); setFormError("");
    setLoanDialogOpen(true);
  };

  const handleSaveLoan = async () => {
    if (!lenderName.trim()) { setFormError("Lender name is required"); return; }
    if (!principal || Number(principal) <= 0) { setFormError("Principal must be a positive amount"); return; }
    if (!startDate) { setFormError("Start date is required"); return; }
    setFormError("");
    setSaving(true);
    try {
      const res = await fetch("/api/accounting/loans", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lender_name: lenderName.trim(), lender_type: lenderType, principal: Number(principal),
          interest_rate: Number(interestRate) || 0, repayment_type: repaymentType, start_date: startDate, notes: notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setFormError(json?.error || "Failed to add loan"); return; }
      setLoanDialogOpen(false);
      fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const openAddRepayment = (loanId?: string) => {
    setRepayLoanId(loanId || loans[0]?.id || "");
    setRepayType("principal");
    setRepayAmount("");
    setRepayDate(new Date().toISOString().slice(0, 10));
    setRepayNote("");
    setRepayError("");
    setRepayDialogOpen(true);
  };

  const handleSaveRepayment = async () => {
    if (!repayLoanId) { setRepayError("Select a loan"); return; }
    if (!repayAmount || Number(repayAmount) <= 0) { setRepayError("Amount must be positive"); return; }
    if (!repayDate) { setRepayError("Repayment date is required"); return; }
    setRepayError("");
    setRepaySaving(true);
    try {
      const res = await fetch("/api/accounting/loan-repayments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loan_id: repayLoanId, type: repayType, amount: Number(repayAmount), repayment_date: repayDate, note: repayNote || null }),
      });
      const json = await res.json();
      if (!res.ok) { setRepayError(json?.error || "Failed to record repayment"); return; }
      setRepayDialogOpen(false);
      fetchAll();
    } finally {
      setRepaySaving(false);
    }
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        {canAdd && (
          <AdminButton variant="outline" onClick={() => openAddRepayment()} disabled={loans.length === 0}>
            <Wallet className="h-4 w-4 mr-1" /> Record Repayment
          </AdminButton>
        )}
        {canAdd && (
          <AdminButton onClick={openAddLoan}>
            <Plus className="h-4 w-4 mr-1" /> Add Loan
          </AdminButton>
        )}
      </div>

      {loans.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-charcoal-lighter">No loans added yet.</CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loans.map((l) => (
            <Card key={l.id} className={!l.is_active ? "opacity-60" : ""}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-secondary" /> {l.lender_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal-lighter">Lender Type</span>
                  <span className="font-medium text-charcoal">{LENDER_TYPE_LABELS[l.lender_type]}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal-lighter">Interest Rate</span>
                  <span className="font-medium text-charcoal">{l.interest_rate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal-lighter">Repayment Type</span>
                  <span className="font-medium text-charcoal">{REPAYMENT_TYPE_LABELS[l.repayment_type]}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal-lighter">Principal</span>
                  <span className="font-medium text-charcoal">{formatCurrency(l.principal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal-lighter">Principal Paid</span>
                  <span className="font-medium text-charcoal">{formatCurrency(l.principal_paid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal-lighter">Due Amount</span>
                  <span className={cn("font-bold", l.due_amount > 0 ? "text-destructive" : "text-success")}>{formatCurrency(l.due_amount)}</span>
                </div>
                <div className="flex justify-between text-xs text-charcoal-lighter pt-1 border-t border-border/30 mt-2">
                  <span>Started {formatDate(l.start_date)}</span>
                  {canAdd && (
                    <button onClick={() => openAddRepayment(l.id)} className="text-secondary hover:underline">+ Repayment</button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><History className="h-4 w-4 text-secondary" /> Repayment History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {repayments.length === 0 ? (
            <p className="text-sm text-charcoal-lighter py-6 text-center">No loan repayments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-left">
                    <th className="px-4 py-3 font-medium text-charcoal-lighter">Lender</th>
                    <th className="px-4 py-3 font-medium text-charcoal-lighter">Type</th>
                    <th className="px-4 py-3 font-medium text-charcoal-lighter hidden md:table-cell">Date</th>
                    <th className="px-4 py-3 font-medium text-charcoal-lighter text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {repayments.map((r) => (
                    <tr key={r.id} className="border-b border-border/20 hover:bg-pearl/50">
                      <td className="px-4 py-3 text-charcoal">{r.lender_name}</td>
                      <td className="px-4 py-3 text-charcoal-lighter">
                        <span className={r.type === "principal" ? "text-secondary" : "text-charcoal-lighter"}>{REPAYMENT_KIND_LABELS[r.type]}</span>
                      </td>
                      <td className="px-4 py-3 text-charcoal-lighter hidden md:table-cell">{formatDate(r.repayment_date)}</td>
                      <td className="px-4 py-3 text-right font-medium text-destructive">-{formatCurrency(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Loan Dialog */}
      <Dialog open={loanDialogOpen} onOpenChange={setLoanDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Loan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input label="Lender Name" value={lenderName} onChange={(e) => setLenderName(e.target.value)} placeholder="e.g. City Bank, John Doe" required />
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Lender Type</label>
              <Select value={lenderType} onValueChange={(v) => setLenderType(v as Loan["lender_type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="person">Person</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Principal (৳)" type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="500000" required />
              <Input label="Interest Rate (%)" type="number" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="12" />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Repayment Type</label>
              <Select value={repaymentType} onValueChange={(v) => setRepaymentType(v as Loan["repayment_type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="installment">Installment</SelectItem>
                  <SelectItem value="profit_based">Profit-based</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px]" />
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setLoanDialogOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={handleSaveLoan} disabled={saving}>{saving ? "Saving..." : "Save"}</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Repayment Dialog */}
      <Dialog open={repayDialogOpen} onOpenChange={setRepayDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Loan Repayment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Loan<span className="text-destructive"> *</span></label>
              <Select value={repayLoanId} onValueChange={setRepayLoanId}>
                <SelectTrigger><SelectValue placeholder="Select loan" /></SelectTrigger>
                <SelectContent>
                  {loans.map((l) => <SelectItem key={l.id} value={l.id}>{l.lender_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Type</label>
              <Select value={repayType} onValueChange={(v) => setRepayType(v as LoanRepayment["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="principal">Principal</SelectItem>
                  <SelectItem value="interest">Interest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Amount (৳)" type="number" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} placeholder="10000" required />
              <Input label="Date" type="date" value={repayDate} onChange={(e) => setRepayDate(e.target.value)} required />
            </div>
            <Textarea label="Note (optional)" value={repayNote} onChange={(e) => setRepayNote(e.target.value)} className="min-h-[60px]" />
            {repayError && <p className="text-sm text-destructive">{repayError}</p>}
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setRepayDialogOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={handleSaveRepayment} disabled={repaySaving}>{repaySaving ? "Saving..." : "Save"}</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
