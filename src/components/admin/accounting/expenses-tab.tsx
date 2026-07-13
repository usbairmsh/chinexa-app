"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Pencil, Settings, Download, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, collectMissingFields } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv";
import { useAdmin } from "@/contexts/admin-context";

interface ExpenseCategory { id: string; name: string; is_active: boolean; sort_order: number; }
interface Expense {
  id: string; category_id: string; category_name: string; amount: number;
  description: string | null; expense_date: string; payment_method: string | null;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ExpensesTab({ year }: { year: number }) {
  const { can } = useAdmin();
  const canAdd = can("accounting", "add");
  const canEdit = can("accounting", "edit");
  const canDelete = can("accounting", "delete");
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formDescription, setFormDescription] = useState("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/accounting/expense-categories");
    const json = await res.json();
    if (res.ok) setCategories(json.data || []);
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ year: String(year), page_size: "100" });
      if (categoryFilter !== "all") params.set("category_id", categoryFilter);
      const res = await fetch(`/api/accounting/expenses?${params}`);
      const json = await res.json();
      if (!res.ok) { setError(json?.error || "Failed to load expenses"); return; }
      setExpenses(json.data || []);
      setTotalAmount(json.total_amount || 0);
    } catch {
      setError("Network error — could not load expenses");
    } finally {
      setLoading(false);
    }
  }, [year, categoryFilter]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const activeCategories = categories.filter((c) => c.is_active);

  const openAddDialog = () => {
    setEditing(null);
    setFormCategoryId(activeCategories[0]?.id || "");
    setFormAmount("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormDescription("");
    setFormPaymentMethod("");
    setDialogOpen(true);
  };

  const openEditDialog = (exp: Expense) => {
    setEditing(exp);
    setFormCategoryId(exp.category_id);
    setFormAmount(String(exp.amount));
    setFormDate(exp.expense_date.slice(0, 10));
    setFormDescription(exp.description || "");
    setFormPaymentMethod(exp.payment_method || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const missing = collectMissingFields([
      { label: "Category", value: formCategoryId },
      { label: "Amount", value: formAmount },
      { label: "Date", value: formDate },
    ]);
    if (missing) { setError(missing); return; }
    if (Number(formAmount) <= 0) { setError("Amount must be greater than zero"); return; }
    setError("");
    setSaving(true);
    try {
      const payload = {
        category_id: formCategoryId, amount: Number(formAmount), expense_date: formDate,
        description: formDescription || null, payment_method: formPaymentMethod || null,
      };
      const res = editing
        ? await fetch(`/api/accounting/expenses/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/accounting/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const json = await res.json(); setError(json?.error || "Failed to save expense"); return; }
      setDialogOpen(false);
      fetchExpenses();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/accounting/expenses/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    fetchExpenses();
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const res = await fetch("/api/accounting/expense-categories", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategoryName.trim() }),
    });
    if (res.ok) { setNewCategoryName(""); fetchCategories(); }
  };

  const handleToggleCategory = async (cat: ExpenseCategory) => {
    await fetch(`/api/accounting/expense-categories/${cat.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !cat.is_active }),
    });
    fetchCategories();
  };

  const handleExport = () => {
    const csv = toCsv(
      ["Category", "Description", "Payment Method", "Date", "Amount"],
      expenses.map((e) => [e.category_name, e.description || "", e.payment_method || "", formatDate(e.expense_date), e.amount])
    );
    downloadCsv(csv, `expenses-${year}.csv`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {activeCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <AdminButton variant="outline" onClick={() => setCategoriesDialogOpen(true)}>
            <Settings className="h-4 w-4 mr-1" /> Manage Categories
          </AdminButton>
          <AdminButton variant="outline" onClick={handleExport} disabled={expenses.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export
          </AdminButton>
          {canAdd && (
            <AdminButton onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-1" /> Add Expense
            </AdminButton>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">Expenses for {year}</CardTitle>
          <span className="text-sm font-semibold text-charcoal">Total: {formatCurrency(totalAmount)}</span>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5"><Skeleton className="h-32 w-full" /></div>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-charcoal-lighter py-6 text-center">No expenses recorded for {year} yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-left">
                    <th className="px-4 py-3 font-medium text-charcoal-lighter">Category</th>
                    <th className="px-4 py-3 font-medium text-charcoal-lighter hidden sm:table-cell">Description</th>
                    <th className="px-4 py-3 font-medium text-charcoal-lighter hidden md:table-cell">Date</th>
                    <th className="px-4 py-3 font-medium text-charcoal-lighter text-right">Amount</th>
                    <th className="px-4 py-3 font-medium text-charcoal-lighter text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="border-b border-border/20 hover:bg-pearl/50">
                      <td className="px-4 py-3 text-charcoal">{exp.category_name}</td>
                      <td className="px-4 py-3 text-charcoal-lighter hidden sm:table-cell truncate max-w-[220px]">{exp.description || "—"}</td>
                      <td className="px-4 py-3 text-charcoal-lighter hidden md:table-cell">{formatDate(exp.expense_date)}</td>
                      <td className="px-4 py-3 text-right font-medium text-charcoal">{formatCurrency(exp.amount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button onClick={() => openEditDialog(exp)} className="p-1.5 rounded-full hover:bg-secondary/10 text-charcoal-lighter hover:text-secondary transition-colors">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => setDeleteTarget(exp)} className="p-1.5 rounded-full hover:bg-destructive/10 text-charcoal-lighter hover:text-destructive transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "Add Expense"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Category<span className="text-destructive"> *</span></label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {activeCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Amount (৳)" type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="1500" required />
              <Input label="Date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
            </div>
            <Input label="Payment Method (optional)" value={formPaymentMethod} onChange={(e) => setFormPaymentMethod(e.target.value)} placeholder="Cash, bKash, Bank..." />
            <Textarea label="Description (optional)" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="What was this expense for?" className="min-h-[70px]" />
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDialogOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={handleSave} disabled={saving || !formCategoryId || !formAmount || Number(formAmount) <= 0}>
              {saving ? "Saving..." : "Save"}
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete this expense?</DialogTitle></DialogHeader>
          <p className="text-sm text-charcoal-lighter">
            {deleteTarget && `${deleteTarget.category_name} — ${formatCurrency(deleteTarget.amount)} on ${formatDate(deleteTarget.expense_date)}`}. This cannot be undone.
          </p>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={handleDelete}>Delete</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Dialog */}
      <Dialog open={categoriesDialogOpen} onOpenChange={setCategoriesDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage Expense Categories</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {canAdd && (
              <div className="flex gap-2">
                <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" />
                <AdminButton onClick={handleAddCategory} disabled={!newCategoryName.trim()}><Plus className="h-4 w-4" /></AdminButton>
              </div>
            )}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/30">
                  <span className={c.is_active ? "text-charcoal" : "text-charcoal-lighter line-through"}>{c.name}</span>
                  {canEdit && (
                    <button
                      onClick={() => handleToggleCategory(c)}
                      className="text-xs font-medium px-2 py-1 rounded-full hover:bg-pearl transition-colors"
                    >
                      {c.is_active ? <span className="text-destructive flex items-center gap-1"><X className="h-3 w-3" /> Deactivate</span> : <span className="text-success">Activate</span>}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <AdminButton onClick={() => setCategoriesDialogOpen(false)}>Done</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
