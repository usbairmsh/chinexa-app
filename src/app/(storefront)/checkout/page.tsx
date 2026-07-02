"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { CreditCard, Truck, FileText, CheckCircle2, MapPin, Clock, Tag, X, Loader2, Home, Briefcase, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth.store";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useCartStore } from "@/stores/cart.store";
import { triggerDashboardRefresh } from "@/lib/dashboard-events";
import { useDeliveryStore } from "@/stores/delivery.store";
import { formatCurrency, cn } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/constants";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { DIVISIONS, DISTRICTS } from "@/data/constants/bangladeshi-data";

const steps = [
  { id: 1, label: "Information", icon: FileText },
  { id: 2, label: "Shipping", icon: Truck },
  { id: 3, label: "Payment", icon: CreditCard },
  { id: 4, label: "Done", icon: CheckCircle2 },
];

// Map division to delivery zone id
const divisionToZone: Record<string, string> = {
  Dhaka: "dhaka-city",
  Chittagong: "chittagong",
  Rajshahi: "rajshahi",
  Khulna: "khulna",
  Barisal: "barisal",
  Sylhet: "sylhet",
  Rangpur: "rangpur",
  Mymensingh: "mymensingh",
};

// Bangladesh phone: must start with 01 and be 11 digits
function isValidBDPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, "");
  return /^01[3-9]\d{8}$/.test(cleaned) || /^\+8801[3-9]\d{8}$/.test(cleaned) || /^8801[3-9]\d{8}$/.test(cleaned);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getSubtotal, clearCart, couponCode, couponDiscount, applyCoupon, removeCoupon } = useCartStore();
  const storeSettings = useStoreSettings();
  const dbPaymentMethods = storeSettings.payment_methods.filter((m) => m.enabled);
  const activePaymentMethods = dbPaymentMethods.length > 0 ? dbPaymentMethods : PAYMENT_METHODS;
  const { freeDeliveryEnabled, freeDeliveryThreshold, zones } = useDeliveryStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [step, setStep] = useState(1);
  const [highestStep, setHighestStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [transactionId, setTransactionId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [placing, setPlacing] = useState(false);
  const [validationError, setValidationError] = useState("");

  // Coupon
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, order_total: getSubtotal() }),
      });
      const data = await res.json();
      if (data.valid) {
        applyCoupon(code, data.discount);
        setCouponInput("");
      } else {
        setCouponError(data.message || "Invalid coupon");
      }
    } catch {
      setCouponError("Failed to validate coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponError("");
  };

  // Contact
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  // Billing
  const [billingAddress, setBillingAddress] = useState("");
  const [billingAddress2, setBillingAddress2] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingPostal, setBillingPostal] = useState("");
  const [billingDivision, setBillingDivision] = useState("");
  const [billingDistrict, setBillingDistrict] = useState("");

  // Field-level errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Saved addresses
  const user = useAuthStore((s) => s.user);
  interface SavedAddress {
    id: string; label: string; name: string; phone: string;
    address_line_1: string; address_line_2?: string;
    city?: string; district?: string; division?: string; postal_code?: string;
    is_default: boolean;
  }
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [useNewAddress, setUseNewAddress] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/customers/${user.id}/addresses`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSavedAddresses(data);
          const defaultAddr = data.find((a: SavedAddress) => a.is_default) || data[0];
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
            applyAddress(defaultAddr);
          }
        } else {
          setUseNewAddress(true);
        }
      })
      .catch(() => { setUseNewAddress(true); });
  }, [user?.id]);

  const applyAddress = (addr: SavedAddress) => {
    setCustomerName(addr.name || user?.name || "");
    setCustomerPhone(addr.phone || user?.phone || "");
    setBillingAddress(addr.address_line_1 || "");
    setBillingAddress2(addr.address_line_2 || "");
    setBillingCity(addr.city || "");
    setBillingDivision(addr.division || "");
    setBillingDistrict(addr.district || "");
    setBillingPostal(addr.postal_code || "");
  };

  const handleSelectAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id);
    setUseNewAddress(false);
    applyAddress(addr);
    setFieldErrors({});
  };

  const handleUseNew = () => {
    setSelectedAddressId(null);
    setUseNewAddress(true);
    setCustomerName(user?.name || "");
    setCustomerPhone(user?.phone || "");
    setBillingAddress(""); setBillingAddress2(""); setBillingCity("");
    setBillingDivision(""); setBillingDistrict(""); setBillingPostal("");
    setFieldErrors({});
  };

  // Shipping
  const [differentShipping, setDifferentShipping] = useState(false);
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingAddress2, setShippingAddress2] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingPostal, setShippingPostal] = useState("");
  const [shippingDivision, setShippingDivision] = useState("");
  const [shippingDistrict, setShippingDistrict] = useState("");

  // Determine active division for shipping calc
  const activeDivision = differentShipping ? shippingDivision : billingDivision;
  const activeDistrict = differentShipping ? shippingDistrict : billingDistrict;

  // Calculate shipping from delivery zones
  const getShippingCost = () => {
    if (!mounted || !activeDivision) return 0;
    const subtotal = getSubtotal();
    if (freeDeliveryEnabled && subtotal >= freeDeliveryThreshold) return 0;
    const zoneId = divisionToZone[activeDivision] || "dhaka-city";
    if (activeDivision === "Dhaka" && activeDistrict && activeDistrict !== "Dhaka") {
      const subZone = zones.find((z) => z.id === "dhaka-sub");
      if (subZone?.isActive) return subZone.charge;
    }
    const zone = zones.find((z) => z.id === zoneId);
    return zone?.charge || 120;
  };

  const getDeliveryTime = () => {
    if (!activeDivision) return "3-5";
    const zoneId = divisionToZone[activeDivision] || "dhaka-city";
    if (activeDivision === "Dhaka" && activeDistrict && activeDistrict !== "Dhaka") {
      const subZone = zones.find((z) => z.id === "dhaka-sub");
      if (subZone) return subZone.estimatedDays;
    }
    const zone = zones.find((z) => z.id === zoneId);
    return zone?.estimatedDays || "3-5";
  };

  const shippingCost = getShippingCost();
  const subtotal = getSubtotal();
  const isFreeShipping = freeDeliveryEnabled && subtotal >= freeDeliveryThreshold;
  const total = subtotal + shippingCost;
  const finalTotal = Math.max(0, total - (couponDiscount || 0));

  const [stockError, setStockError] = useState<string[]>([]);

  // ─── STEP 1 VALIDATION ───
  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};

    if (!customerName.trim()) errors.customerName = "Full name is required";
    else if (customerName.trim().length < 3) errors.customerName = "Name must be at least 3 characters";

    if (!customerPhone.trim()) errors.customerPhone = "Phone number is required";
    else if (!isValidBDPhone(customerPhone)) errors.customerPhone = "Enter a valid Bangladesh phone number (01XXXXXXXXX)";

    if (customerEmail.trim() && !isValidEmail(customerEmail)) errors.customerEmail = "Enter a valid email address";

    if (useNewAddress || savedAddresses.length === 0) {
      if (!billingAddress.trim()) errors.billingAddress = "Address is required";
      else if (billingAddress.trim().length < 5) errors.billingAddress = "Address must be at least 5 characters";
      if (!billingDivision) errors.billingDivision = "Division is required";
      if (!billingDistrict) errors.billingDistrict = "District is required";
      if (!billingCity.trim()) errors.billingCity = "City / Area is required";
    }

    if (differentShipping) {
      if (!shippingName.trim()) errors.shippingName = "Recipient name is required";
      if (!shippingPhone.trim()) errors.shippingPhone = "Phone number is required";
      else if (!isValidBDPhone(shippingPhone)) errors.shippingPhone = "Enter a valid Bangladesh phone number";
      if (!shippingAddress.trim()) errors.shippingAddress = "Shipping address is required";
      if (!shippingDivision) errors.shippingDivision = "Division is required";
      if (!shippingDistrict) errors.shippingDistrict = "District is required";
      if (!shippingCity.trim()) errors.shippingCity = "City / Area is required";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setValidationError("Please fix the highlighted fields above");
      return false;
    }
    setValidationError("");
    return true;
  };

  // ─── STEP 3 VALIDATION ───
  const validateStep3 = (): boolean => {
    const errors: Record<string, string> = {};
    if (paymentMethod !== "COD" && !transactionId.trim()) {
      errors.transactionId = "Transaction ID is required for online payments";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return false;
    return true;
  };

  const goToStep = (target: number) => {
    if (target >= step || target === 4) return;
    setFieldErrors({});
    setValidationError("");
    setStep(target);
  };

  const advanceStep = (target: number) => {
    setStep(target);
    setHighestStep((prev) => Math.max(prev, target));
  };

  const handlePlaceOrder = async () => {
    if (!validateStep3()) return;
    setPlacing(true);
    setStockError([]);

    try {
      // Validate stock before placing order
      const validateRes = await fetch("/api/cart/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({ product_id: item.product_id, variant_id: item.variant_id, quantity: item.quantity })),
        }),
      });
      const validateData = await validateRes.json();

      if (!validateData.valid) {
        const issues = (validateData.items || [])
          .filter((i: { in_stock: boolean }) => !i.in_stock)
          .map((i: { product_name: string; available: number; requested: number }) =>
            i.available === 0 ? `${i.product_name} is out of stock` : `${i.product_name} — only ${i.available} left (you have ${i.requested})`
          );
        setStockError(issues);
        setPlacing(false);
        return;
      }

      const billingAddr = {
        name: customerName, phone: customerPhone, email: customerEmail || null,
        address_line_1: billingAddress, address_line_2: billingAddress2 || null,
        city: billingCity || null, district: billingDistrict || null,
        division: billingDivision || null, postal_code: billingPostal || null,
      };

      const shippingAddr = differentShipping ? {
        name: shippingName || customerName, phone: shippingPhone || customerPhone,
        address_line_1: shippingAddress, address_line_2: shippingAddress2 || null,
        city: shippingCity || null, district: shippingDistrict || null,
        division: shippingDivision || null, postal_code: shippingPostal || null,
      } : billingAddr;

      const orderItems = items.map((item) => ({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        product_name: item.product_name,
        product_image: item.product_image,
        product_slug: item.product_slug,
        variant: item.variant_name || null,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
      }));

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName,
          customer_phone: customerPhone,
          subtotal,
          shipping_cost: shippingCost,
          discount: couponDiscount || 0,
          tax: 0,
          total: finalTotal,
          payment_method: paymentMethod,
          payment_status: "pending",
          transaction_id: paymentMethod !== "COD" ? transactionId.trim() : null,
          coupon_code: couponCode || null,
          items: orderItems,
          billing_address: billingAddr,
          shipping_address: shippingAddr,
        }),
      });

      const data = await res.json();

      if (!res.ok && data.out_of_stock) {
        setStockError(data.out_of_stock);
        setPlacing(false);
        return;
      }

      setOrderNumber(data.order_number || data.id || "");
      triggerDashboardRefresh();

      // Auto-save new address to user profile
      if (user?.id && (useNewAddress || savedAddresses.length === 0) && billingAddress.trim()) {
        fetch(`/api/customers/${user.id}/addresses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: "Home", name: customerName, phone: customerPhone,
            address_line_1: billingAddress, address_line_2: billingAddress2 || null,
            city: billingCity || null, district: billingDistrict || null,
            division: billingDivision || null, postal_code: billingPostal || null,
            is_default: savedAddresses.length === 0,
          }),
        }).catch(() => {});
      }

      advanceStep(4);
      setTimeout(() => clearCart(), 2000);
    } catch {
      advanceStep(4);
      setTimeout(() => clearCart(), 2000);
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0 && step !== 4) {
    router.push("/cart");
    return null;
  }

  const billingDistricts = billingDivision ? (DISTRICTS[billingDivision] || []) : [];
  const shippingDistricts = shippingDivision ? (DISTRICTS[shippingDivision] || []) : [];

  // Helper to show inline error
  const FieldError = ({ field }: { field: string }) => {
    const err = fieldErrors[field];
    if (!err) return null;
    return <p className="text-xs text-destructive mt-1">{err}</p>;
  };

  return (
    <div className="bg-white min-h-screen overflow-x-hidden">
      <div className="mx-auto max-w-4xl px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Breadcrumb items={[{ label: "Cart", href: "/cart" }, { label: "Checkout" }]} className="mb-6" />

        {/* Steps */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8 sm:mb-10">
          {steps.map((s, i) => {
            const canClick = s.id < step && s.id !== 4;
            return (
              <div key={s.id} className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  disabled={!canClick}
                  onClick={() => goToStep(s.id)}
                  className={cn(
                    "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-xs sm:text-sm font-medium transition-colors",
                    step >= s.id ? "bg-secondary text-white" : "bg-pearl text-charcoal-lighter",
                    canClick ? "cursor-pointer hover:opacity-80" : "cursor-default"
                  )}
                >
                  {step > s.id ? <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : s.id}
                </button>
                <span
                  onClick={() => canClick && goToStep(s.id)}
                  className={cn(
                    "hidden sm:block text-sm",
                    step >= s.id ? "text-charcoal font-medium" : "text-charcoal-lighter",
                    canClick ? "cursor-pointer hover:opacity-80" : ""
                  )}
                >{s.label}</span>
                {i < steps.length - 1 && <div className={cn("w-5 sm:w-16 h-px", step > s.id ? "bg-secondary" : "bg-border")} />}
              </div>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Form */}
          <div className="lg:col-span-3 order-2 lg:order-1 min-w-0">
            {/* ═══ STEP 1: Information ═══ */}
            {step === 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                {/* Saved Addresses */}
                {savedAddresses.length > 0 && (
                  <div>
                    <h2 className="font-heading text-xl font-semibold text-charcoal mb-3">Deliver To</h2>
                    <div className="grid gap-2">
                      {savedAddresses.map((addr) => {
                        const isSelected = selectedAddressId === addr.id && !useNewAddress;
                        const Icon = addr.label === "Office" ? Briefcase : Home;
                        return (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => handleSelectAddress(addr)}
                            className={cn(
                              "w-full flex items-start gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl border text-left transition-all duration-200",
                              isSelected
                                ? "border-secondary bg-secondary/5"
                                : "border-border/50 hover:border-secondary/40"
                            )}
                          >
                            <div className={cn("flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg shrink-0 mt-0.5", isSelected ? "bg-secondary/10 text-secondary" : "bg-pearl text-charcoal-lighter")}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-semibold text-charcoal">{addr.label}</span>
                                {addr.is_default && <Badge variant="secondary" className="text-[8px] !text-white">Default</Badge>}
                                {isSelected && <CheckCircle2 className="h-4 w-4 text-secondary ml-auto shrink-0" />}
                              </div>
                              <p className="text-xs text-charcoal">{addr.name} &middot; {addr.phone}</p>
                              <p className="text-xs text-charcoal-lighter truncate">{addr.address_line_1}{addr.address_line_2 ? `, ${addr.address_line_2}` : ""}</p>
                              <p className="text-xs text-charcoal-lighter">{[addr.city, addr.district, addr.division].filter(Boolean).join(", ")}</p>
                            </div>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={handleUseNew}
                        className={cn(
                          "w-full flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl border text-left transition-all duration-200",
                          useNewAddress
                            ? "border-secondary bg-secondary/5"
                            : "border-dashed border-border/50 hover:border-secondary/40"
                        )}
                      >
                        <div className={cn("flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg shrink-0", useNewAddress ? "bg-secondary/10 text-secondary" : "bg-pearl text-charcoal-lighter")}>
                          <Plus className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-charcoal">Use a new address</span>
                        {useNewAddress && <CheckCircle2 className="h-4 w-4 text-secondary ml-auto shrink-0" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Contact & Address Form */}
                {(useNewAddress || savedAddresses.length === 0) && (
                  <>
                <h2 className="font-heading text-xl font-semibold text-charcoal">Contact Information</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Input label="Full Name *" placeholder="Fatima Akter" value={customerName} onChange={(e) => { setCustomerName(e.target.value); setFieldErrors((p) => ({ ...p, customerName: "" })); }} className={fieldErrors.customerName ? "border-destructive" : ""} />
                    <FieldError field="customerName" />
                  </div>
                  <div>
                    <Input label="Phone Number *" placeholder="01XXXXXXXXX" type="tel" value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value); setFieldErrors((p) => ({ ...p, customerPhone: "" })); }} className={fieldErrors.customerPhone ? "border-destructive" : ""} />
                    <FieldError field="customerPhone" />
                  </div>
                  <div className="sm:col-span-2">
                    <Input label="Email (Optional)" placeholder="email@example.com" type="email" value={customerEmail} onChange={(e) => { setCustomerEmail(e.target.value); setFieldErrors((p) => ({ ...p, customerEmail: "" })); }} className={fieldErrors.customerEmail ? "border-destructive" : ""} />
                    <FieldError field="customerEmail" />
                  </div>
                </div>

                <h2 className="font-heading text-xl font-semibold text-charcoal pt-4">Billing Address</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Input label="Address Line 1 *" placeholder="House/Flat, Road" value={billingAddress} onChange={(e) => { setBillingAddress(e.target.value); setFieldErrors((p) => ({ ...p, billingAddress: "" })); }} className={fieldErrors.billingAddress ? "border-destructive" : ""} />
                    <FieldError field="billingAddress" />
                  </div>
                  <Input label="Address Line 2 (Optional)" placeholder="Area, Landmark" className="sm:col-span-2" value={billingAddress2} onChange={(e) => setBillingAddress2(e.target.value)} />
                  <div>
                    <label className="block text-sm font-medium text-charcoal-light mb-1.5">Division *</label>
                    <Select value={billingDivision} onValueChange={(v) => { setBillingDivision(v); setBillingDistrict(""); setFieldErrors((p) => ({ ...p, billingDivision: "", billingDistrict: "" })); }}>
                      <SelectTrigger className={fieldErrors.billingDivision ? "border-destructive" : ""}><SelectValue placeholder="Select Division" /></SelectTrigger>
                      <SelectContent>
                        {DIVISIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FieldError field="billingDivision" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-charcoal-light mb-1.5">District *</label>
                    <Select value={billingDistrict} onValueChange={(v) => { setBillingDistrict(v); setFieldErrors((p) => ({ ...p, billingDistrict: "" })); }} disabled={!billingDivision}>
                      <SelectTrigger className={fieldErrors.billingDistrict ? "border-destructive" : ""}><SelectValue placeholder={billingDivision ? "Select District" : "Select division first"} /></SelectTrigger>
                      <SelectContent>
                        {billingDistricts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FieldError field="billingDistrict" />
                  </div>
                  <div>
                    <Input label="City / Area *" placeholder="Gulshan-2" value={billingCity} onChange={(e) => { setBillingCity(e.target.value); setFieldErrors((p) => ({ ...p, billingCity: "" })); }} className={fieldErrors.billingCity ? "border-destructive" : ""} />
                    <FieldError field="billingCity" />
                  </div>
                  <Input label="Postal Code (Optional)" placeholder="1212" value={billingPostal} onChange={(e) => setBillingPostal(e.target.value)} />
                </div>

                  </>
                )}

                {/* Different Shipping Address */}
                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox checked={differentShipping} onCheckedChange={(v) => { setDifferentShipping(!!v); setFieldErrors({}); }} />
                    <span className="text-sm font-medium text-charcoal">Ship to a different address</span>
                  </label>
                </div>

                {differentShipping && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 pt-2">
                    <h2 className="font-heading text-xl font-semibold text-charcoal flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-secondary" /> Shipping Address
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Input label="Recipient Name *" placeholder="Full name" value={shippingName} onChange={(e) => { setShippingName(e.target.value); setFieldErrors((p) => ({ ...p, shippingName: "" })); }} className={fieldErrors.shippingName ? "border-destructive" : ""} />
                        <FieldError field="shippingName" />
                      </div>
                      <div>
                        <Input label="Phone Number *" placeholder="01XXXXXXXXX" type="tel" value={shippingPhone} onChange={(e) => { setShippingPhone(e.target.value); setFieldErrors((p) => ({ ...p, shippingPhone: "" })); }} className={fieldErrors.shippingPhone ? "border-destructive" : ""} />
                        <FieldError field="shippingPhone" />
                      </div>
                      <div className="sm:col-span-2">
                        <Input label="Address Line 1 *" placeholder="House/Flat, Road" value={shippingAddress} onChange={(e) => { setShippingAddress(e.target.value); setFieldErrors((p) => ({ ...p, shippingAddress: "" })); }} className={fieldErrors.shippingAddress ? "border-destructive" : ""} />
                        <FieldError field="shippingAddress" />
                      </div>
                      <Input label="Address Line 2 (Optional)" placeholder="Area, Landmark" className="sm:col-span-2" value={shippingAddress2} onChange={(e) => setShippingAddress2(e.target.value)} />
                      <div>
                        <label className="block text-sm font-medium text-charcoal-light mb-1.5">Division *</label>
                        <Select value={shippingDivision} onValueChange={(v) => { setShippingDivision(v); setShippingDistrict(""); setFieldErrors((p) => ({ ...p, shippingDivision: "", shippingDistrict: "" })); }}>
                          <SelectTrigger className={fieldErrors.shippingDivision ? "border-destructive" : ""}><SelectValue placeholder="Select Division" /></SelectTrigger>
                          <SelectContent>
                            {DIVISIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FieldError field="shippingDivision" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-charcoal-light mb-1.5">District *</label>
                        <Select value={shippingDistrict} onValueChange={(v) => { setShippingDistrict(v); setFieldErrors((p) => ({ ...p, shippingDistrict: "" })); }} disabled={!shippingDivision}>
                          <SelectTrigger className={fieldErrors.shippingDistrict ? "border-destructive" : ""}><SelectValue placeholder={shippingDivision ? "Select District" : "Select division first"} /></SelectTrigger>
                          <SelectContent>
                            {shippingDistricts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FieldError field="shippingDistrict" />
                      </div>
                      <div>
                        <Input label="City / Area *" placeholder="Area name" value={shippingCity} onChange={(e) => { setShippingCity(e.target.value); setFieldErrors((p) => ({ ...p, shippingCity: "" })); }} className={fieldErrors.shippingCity ? "border-destructive" : ""} />
                        <FieldError field="shippingCity" />
                      </div>
                      <Input label="Postal Code (Optional)" placeholder="1205" value={shippingPostal} onChange={(e) => setShippingPostal(e.target.value)} />
                    </div>
                  </motion.div>
                )}

                {/* Delivery charge preview */}
                {activeDivision && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 sm:p-4 rounded-xl bg-pearl/60 border border-border/20 space-y-2">
                    <p className="text-xs font-semibold text-charcoal flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-secondary" /> Delivery Estimate
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-charcoal-lighter">
                        {differentShipping ? shippingDivision : billingDivision}
                        {(differentShipping ? shippingDistrict : billingDistrict) ? `, ${differentShipping ? shippingDistrict : billingDistrict}` : ""}
                      </span>
                      <span className="font-semibold text-charcoal">
                        {isFreeShipping ? (
                          <span className="text-success">Free</span>
                        ) : (
                          formatCurrency(shippingCost)
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-charcoal-lighter">
                      <Clock className="h-3 w-3" /> Estimated delivery: {getDeliveryTime()} business days
                    </div>
                    {isFreeShipping && (
                      <p className="text-[10px] text-success">Free delivery on orders above {formatCurrency(freeDeliveryThreshold)}</p>
                    )}
                  </motion.div>
                )}

                {validationError && (
                  <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-3 sm:px-4 py-2">{validationError}</p>
                )}

                <Button variant="secondary" size="lg" className="w-full sm:w-auto !text-white" onClick={() => {
                  if (validateStep1()) advanceStep(2);
                }}>
                  Continue to Shipping
                </Button>
              </motion.div>
            )}

            {/* ═══ STEP 2: Shipping + Coupon ═══ */}
            {step === 2 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <h2 className="font-heading text-xl font-semibold text-charcoal">Shipping Method</h2>

                {/* Delivery to */}
                <div className="p-3 rounded-xl bg-pearl/50 flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-secondary shrink-0" />
                  <span className="text-charcoal-lighter">Delivering to:</span>
                  <span className="font-medium text-charcoal">
                    {activeDivision}{activeDistrict ? `, ${activeDistrict}` : ""}
                  </span>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-secondary bg-primary-light cursor-pointer">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <input type="radio" name="shipping" defaultChecked className="accent-secondary shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-charcoal">Standard Delivery</p>
                        <p className="text-xs text-charcoal-lighter">{getDeliveryTime()} business days</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold shrink-0 ml-2">{isFreeShipping ? <span className="text-success">Free</span> : formatCurrency(shippingCost)}</span>
                  </label>
                  {activeDivision === "Dhaka" && (
                    <label className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-border cursor-pointer hover:border-secondary transition-colors">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <input type="radio" name="shipping" className="accent-secondary shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-charcoal">Express Delivery</p>
                          <p className="text-xs text-charcoal-lighter">Next day delivery (Dhaka only)</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold shrink-0 ml-2">৳200</span>
                    </label>
                  )}
                </div>

                <Textarea label="Order Notes (Optional)" placeholder="Any special delivery instructions..." />

                {/* Coupon Code — moved here from Step 3 */}
                <div>
                  <h3 className="text-sm font-medium text-charcoal mb-2">Have a coupon?</h3>
                  {couponCode ? (
                    <div className="p-3 rounded-xl bg-success/5 border border-success/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-success" />
                          <code className="text-sm font-bold text-success">{couponCode}</code>
                          <span className="text-xs text-success/70">−{formatCurrency(couponDiscount)}</span>
                        </div>
                        <button onClick={handleRemoveCoupon} className="text-charcoal-lighter hover:text-destructive transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter coupon code"
                          className="flex-1 h-10"
                          value={couponInput}
                          onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                          onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                        />
                        <Button variant="outline" size="sm" onClick={handleApplyCoupon} disabled={couponLoading || !couponInput.trim()}>
                          {couponLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                        </Button>
                      </div>
                      {couponError && <p className="text-xs text-destructive mt-1.5">{couponError}</p>}
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto !text-white" onClick={() => advanceStep(3)}>Continue to Payment</Button>
                </div>
              </motion.div>
            )}

            {/* ═══ STEP 3: Payment ═══ */}
            {step === 3 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <h2 className="font-heading text-xl font-semibold text-charcoal">Payment Method</h2>
                <div className="space-y-3">
                  {activePaymentMethods.map((method) => (
                    <label key={method.id}
                      className={cn("flex items-center justify-between p-3 sm:p-4 rounded-xl border cursor-pointer transition-colors",
                        paymentMethod === method.id ? "border-secondary bg-primary-light" : "border-border hover:border-secondary")}>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <input type="radio" name="payment" value={method.id} checked={paymentMethod === method.id} onChange={() => { setPaymentMethod(method.id); setFieldErrors({}); }} className="accent-secondary" />
                        <span className="text-sm font-medium text-charcoal">{method.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
                {paymentMethod !== "COD" && (
                  <div className="p-3 sm:p-4 rounded-xl bg-pearl/50 space-y-3">
                    <div>
                      <Input label="Transaction ID *" placeholder="Enter transaction ID" value={transactionId} onChange={(e) => { setTransactionId(e.target.value); setFieldErrors((p) => ({ ...p, transactionId: "" })); }} className={fieldErrors.transactionId ? "border-destructive" : ""} />
                      <FieldError field="transactionId" />
                    </div>
                    <p className="text-xs text-charcoal-lighter">
                      {(() => { const m = activePaymentMethods.find((pm) => pm.id === paymentMethod); return m && 'account_number' in m && m.account_number ? `Please send payment to: ${m.account_number}` : `Please send payment via ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}`; })()}
                    </p>
                  </div>
                )}

                {/* Price Breakdown */}
                <div className="p-3 sm:p-4 rounded-xl border border-border/30 bg-pearl/20 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-charcoal-lighter">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-charcoal-lighter">Shipping</span>
                    <span>{isFreeShipping ? <span className="text-success font-medium">Free</span> : formatCurrency(shippingCost)}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-success">
                      <span className="flex items-center gap-1">Discount <code className="text-[9px] bg-success/10 px-1 rounded">{couponCode}</code></span>
                      <span>−{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-charcoal text-base">
                    <span>Total</span>
                    <span>{formatCurrency(finalTotal)}</span>
                  </div>
                </div>

                {stockError.length > 0 && (
                  <div className="p-3 sm:p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-1">
                    <p className="text-sm font-semibold text-destructive">Some items are no longer available:</p>
                    {stockError.map((err, i) => (
                      <p key={i} className="text-xs text-destructive/80">• {err}</p>
                    ))}
                    <p className="text-xs text-charcoal-lighter mt-2">Please update your cart and try again.</p>
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto !text-white" onClick={handlePlaceOrder} isLoading={placing} disabled={placing}>
                    {placing ? "Placing Order..." : `Place Order — ${formatCurrency(finalTotal)}`}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>

          {/* ═══ Order Summary Sidebar ═══ */}
          {step < 4 && (
            <div className="lg:col-span-2 order-1 lg:order-2 min-w-0">
              <div className="rounded-2xl border border-border/30 bg-pearl/30 p-3 sm:p-5 lg:sticky lg:top-24">
                <h3 className="font-heading text-base font-semibold text-charcoal mb-4">
                  Order Summary ({items.length})
                </h3>
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="relative h-14 w-12 rounded-lg overflow-hidden bg-white shrink-0">
                        <Image src={item.product_image} alt={item.product_name} fill className="object-cover" sizes="48px" />
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-charcoal text-[10px] text-white font-bold">{item.quantity}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-charcoal truncate">{item.product_name}</p>
                        <p className="text-xs font-medium text-charcoal">{formatCurrency(item.price * item.quantity)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator className="my-3" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-charcoal-lighter">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-charcoal-lighter">Shipping</span>
                    <span>
                      {!activeDivision ? (
                        <span className="text-[10px] text-charcoal-lighter">Select address</span>
                      ) : isFreeShipping ? (
                        <span className="text-success font-medium">Free</span>
                      ) : (
                        formatCurrency(shippingCost)
                      )}
                    </span>
                  </div>
                  {isFreeShipping && activeDivision && (
                    <p className="text-[10px] text-success">Free delivery on orders above {formatCurrency(freeDeliveryThreshold)}</p>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-success">
                      <span className="flex items-center gap-1">Discount <code className="text-[9px] bg-success/10 px-1 rounded">{couponCode}</code></span>
                      <span>-{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between font-semibold text-charcoal">
                  <span>Total</span>
                  <span>{formatCurrency(finalTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 4: Done ═══ */}
          {step === 4 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="col-span-full text-center py-10 sm:py-16 order-1">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 15, delay: 0.2 }}>
                <CheckCircle2 className="h-16 w-16 sm:h-20 sm:w-20 text-success mx-auto mb-4 sm:mb-6" />
              </motion.div>
              <h2 className="font-heading text-xl sm:text-2xl font-semibold text-charcoal mb-2">Order Confirmed!</h2>
              <p className="text-charcoal-lighter mb-2">Thank you for shopping with ChineXa</p>
              <p className="text-sm text-charcoal mb-6 sm:mb-8 px-4">
                Order #{orderNumber || "Processing"} has been placed successfully.<br />You will receive a confirmation via SMS shortly.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center px-4">
                <Link href="/products"><Button variant="primary" className="w-full sm:w-auto !text-white">Continue Shopping</Button></Link>
                <Link href="/track-order"><Button variant="outline" className="w-full sm:w-auto">Track Order</Button></Link>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
