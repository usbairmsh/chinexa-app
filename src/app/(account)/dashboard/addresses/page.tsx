"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, MapPin, Edit, Trash2, Star, MoreHorizontal, Home, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DIVISIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const demoAddresses = [
  {
    id: "addr-1",
    label: "Home",
    icon: Home,
    name: "Fatima Akter",
    phone: "+880 1712-345678",
    address: "House 12, Road 5, Block D",
    area: "Gulshan-2",
    city: "Dhaka",
    district: "Dhaka",
    division: "Dhaka",
    postal: "1212",
    is_default: true,
  },
  {
    id: "addr-2",
    label: "Office",
    icon: Briefcase,
    name: "Fatima Akter",
    phone: "+880 1712-345678",
    address: "Suite 4B, Navana Tower",
    area: "Gulshan Avenue",
    city: "Dhaka",
    district: "Dhaka",
    division: "Dhaka",
    postal: "1212",
    is_default: false,
  },
];

export default function AddressesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-charcoal">My Addresses</h2>
        <Button variant="secondary" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Address
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {demoAddresses.map((addr, i) => {
          const Icon = addr.icon;
          return (
            <motion.div key={addr.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={cn("relative", addr.is_default && "ring-2 ring-secondary/30")}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl",
                        addr.is_default ? "bg-secondary/10 text-secondary" : "bg-pearl text-charcoal-lighter"
                      )}>
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
                      <DropdownMenuTrigger className="p-1.5 hover:bg-pearl rounded-lg">
                        <MoreHorizontal className="h-4 w-4 text-charcoal-lighter" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Edit className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                        {!addr.is_default && <DropdownMenuItem><Star className="h-3.5 w-3.5 mr-2" /> Set as Default</DropdownMenuItem>}
                        <DropdownMenuItem className="text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="text-sm space-y-0.5 text-charcoal-light">
                    <p className="font-medium text-charcoal">{addr.name}</p>
                    <p>{addr.phone}</p>
                    <p>{addr.address}</p>
                    <p>{addr.area}, {addr.city} {addr.postal}</p>
                    <p>{addr.district}, {addr.division}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {/* Add New Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <button
            onClick={() => setDialogOpen(true)}
            className="w-full h-full min-h-[200px] rounded-2xl border-2 border-dashed border-border/40 hover:border-secondary/40 hover:bg-primary-light/30 transition-all flex flex-col items-center justify-center gap-2 text-charcoal-lighter hover:text-secondary"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pearl">
              <Plus className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium">Add New Address</span>
          </button>
        </motion.div>
      </div>

      {/* Add Address Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Address</DialogTitle>
            <DialogDescription>Add a shipping or billing address</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Label" placeholder="e.g., Home, Office" />
              <Input label="Full Name" placeholder="Fatima Akter" />
            </div>
            <Input label="Phone Number" placeholder="+880 1XXXXXXXXX" type="tel" />
            <Input label="Address Line 1" placeholder="House/Flat, Road" />
            <Input label="Address Line 2 (Area)" placeholder="Area, Landmark" />
            <div className="grid grid-cols-2 gap-3">
              <Select>
                <SelectTrigger><SelectValue placeholder="Division" /></SelectTrigger>
                <SelectContent>
                  {DIVISIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input label="District" placeholder="District" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="City" placeholder="City" />
              <Input label="Postal Code" placeholder="1212" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Save Address</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
