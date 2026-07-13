"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, MapPin, Edit, Trash2, Star, MoreHorizontal, Home, Briefcase, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DIVISIONS } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

interface Address {
  id: string; label: string; name: string; phone: string;
  address_line_1: string; address_line_2?: string;
  city?: string; district?: string; division?: string; postal_code?: string;
  is_default: boolean;
}

const labelIcons: Record<string, typeof Home> = { Home, Office: Briefcase };

export default function AddressesPage() {
  const user = useAuthStore((s) => s.user);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAddr, setEditAddr] = useState<Address | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [fLabel, setFLabel] = useState("Home");
  const [fName, setFName] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fAddr1, setFAddr1] = useState("");
  const [fAddr2, setFAddr2] = useState("");
  const [fCity, setFCity] = useState("");
  const [fDistrict, setFDistrict] = useState("");
  const [fDivision, setFDivision] = useState("");
  const [fPostal, setFPostal] = useState("");
  const [fDefault, setFDefault] = useState(false);

  const fetchAddresses = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/customers/${user.id}/addresses`);
      const data = await res.json();
      if (Array.isArray(data)) setAddresses(data);
    } catch {} finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  const resetForm = () => {
    setFLabel("Home"); setFName(user?.name || ""); setFPhone(user?.phone || "");
    setFAddr1(""); setFAddr2(""); setFCity(""); setFDistrict(""); setFDivision(""); setFPostal("");
    setFDefault(false); setEditAddr(null);
  };

  const openCreate = () => { resetForm(); setFDefault(addresses.length === 0); setDialogOpen(true); };

  const openEdit = (addr: Address) => {
    setEditAddr(addr);
    setFLabel(addr.label); setFName(addr.name); setFPhone(addr.phone);
    setFAddr1(addr.address_line_1); setFAddr2(addr.address_line_2 || "");
    setFCity(addr.city || ""); setFDistrict(addr.district || "");
    setFDivision(addr.division || ""); setFPostal(addr.postal_code || "");
    setFDefault(addr.is_default);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user?.id || !fName.trim() || !fAddr1.trim()) return;
    setSaving(true);
    try {
      const payload = {
        label: fLabel, name: fName.trim(), phone: fPhone.trim(),
        address_line_1: fAddr1.trim(), address_line_2: fAddr2.trim() || null,
        city: fCity.trim() || null, district: fDistrict.trim() || null,
        division: fDivision || null, postal_code: fPostal.trim() || null,
        is_default: fDefault || addresses.length === 0,
      };
      if (editAddr) {
        await fetch(`/api/customers/${user.id}/addresses/${editAddr.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        await fetch(`/api/customers/${user.id}/addresses`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      }
      setDialogOpen(false); resetForm(); fetchAddresses();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteDialog || !user?.id) return;
    await fetch(`/api/customers/${user.id}/addresses/${deleteDialog.id}`, { method: "DELETE" });
    setDeleteDialog(null); fetchAddresses();
  };

  const handleSetDefault = async (addr: Address) => {
    if (!user?.id) return;
    await fetch(`/api/customers/${user.id}/addresses/${addr.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_default: true }),
    });
    fetchAddresses();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-charcoal">My Addresses</h2>
        <Button variant="secondary" size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Address
        </Button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/20 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-9 w-9 bg-pearl rounded-xl animate-pulse" />
                <div className="h-4 w-20 bg-pearl rounded animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-32 bg-pearl rounded animate-pulse" />
                <div className="h-3 w-28 bg-pearl rounded animate-pulse" />
                <div className="h-3 w-48 bg-pearl rounded animate-pulse" />
                <div className="h-3 w-36 bg-pearl rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map((addr, i) => {
            const Icon = labelIcons[addr.label] || MapPin;
            return (
              <motion.div key={addr.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={cn("relative", addr.is_default && "ring-2 ring-secondary/30")}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", addr.is_default ? "bg-secondary/10 text-secondary" : "bg-pearl text-charcoal-lighter")}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-charcoal">{addr.label}</span>
                            {addr.is_default && <Badge variant="secondary" className="text-[8px]">Default</Badge>}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-2.5 -m-1 hover:bg-pearl rounded-lg">
                          <MoreHorizontal className="h-4 w-4 text-charcoal-lighter" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(addr)}><Edit className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                          {!addr.is_default && <DropdownMenuItem onClick={() => handleSetDefault(addr)}><Star className="h-3.5 w-3.5 mr-2" /> Set as Default</DropdownMenuItem>}
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(addr)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="text-sm space-y-0.5 text-charcoal-light">
                      <p className="font-medium text-charcoal">{addr.name}</p>
                      <p>{addr.phone}</p>
                      <p>{addr.address_line_1}</p>
                      {addr.address_line_2 && <p>{addr.address_line_2}</p>}
                      <p>{[addr.city, addr.postal_code].filter(Boolean).join(" ")}</p>
                      <p>{[addr.district, addr.division].filter(Boolean).join(", ")}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <button onClick={openCreate} className="w-full h-full min-h-[200px] rounded-2xl border-2 border-dashed border-border/40 hover:border-secondary/40 hover:bg-primary-light/30 transition-all flex flex-col items-center justify-center gap-2 text-charcoal-lighter hover:text-secondary">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pearl"><Plus className="h-5 w-5" /></div>
              <span className="text-sm font-medium">Add New Address</span>
            </button>
          </motion.div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editAddr ? "Edit Address" : "Add New Address"}</DialogTitle>
            <DialogDescription>Enter your shipping or billing address</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-1.5">Label</label>
                <Select value={fLabel} onValueChange={setFLabel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Home">Home</SelectItem>
                    <SelectItem value="Office">Office</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input label="Full Name" required value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Your name" />
            </div>
            <Input label="Phone Number" required value={fPhone} onChange={(e) => setFPhone(e.target.value)} placeholder="+880 1XXXXXXXXX" type="tel" />
            <Input label="Address Line 1" required value={fAddr1} onChange={(e) => setFAddr1(e.target.value)} placeholder="House/Flat, Road" />
            <Input label="Address Line 2 (Area)" value={fAddr2} onChange={(e) => setFAddr2(e.target.value)} placeholder="Area, Landmark" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-1.5">Division</label>
                <Select value={fDivision} onValueChange={setFDivision}>
                  <SelectTrigger><SelectValue placeholder="Division" /></SelectTrigger>
                  <SelectContent>
                    {DIVISIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input label="District" value={fDistrict} onChange={(e) => setFDistrict(e.target.value)} placeholder="District" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="City" value={fCity} onChange={(e) => setFCity(e.target.value)} placeholder="City" />
              <Input label="Postal Code" value={fPostal} onChange={(e) => setFPostal(e.target.value)} placeholder="1212" />
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2">
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button variant="secondary" onClick={handleSave} disabled={saving || !fName.trim() || !fAddr1.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editAddr ? "Update" : "Save"} Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Address</DialogTitle>
            <DialogDescription>Are you sure you want to delete the &quot;{deleteDialog?.label}&quot; address?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
