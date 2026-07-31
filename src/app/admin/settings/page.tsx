"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Settings, Store, Truck, CreditCard, Bell, Save, Loader2, Check,
  Plus, Trash2, X, Edit, Globe, FolderTree, ShoppingCart, Award, Users, Search,
  BookOpen, Megaphone, Mail, MessageSquare
} from "lucide-react";
import { SOCIAL_PLATFORMS, getPlatform } from "@/lib/social-platforms";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { ImageUpload } from "@/components/admin/shared/image-upload";
import { useFlushUploads, cleanupReplacedImage } from "@/components/admin/shared/pending-uploads";
import { FieldLabel } from "@/components/admin/shared/field-label";
import { useDeliveryStore } from "@/stores/delivery.store";
import { formatCurrency, cn, randomId } from "@/lib/utils";
import type { OfferApplicability } from "@/types/offer";
import { DEFAULT_OUR_STORY, type OurStoryContent, type OurStoryValue, type OurStoryStat } from "@/types/our-story";
import { OUR_STORY_ICON_MAP, OUR_STORY_ICON_OPTIONS } from "@/lib/our-story-icons";
import type { InstagramPost } from "@/types/instagram-feed";
import type { FaqItem } from "@/types/faq";

type Tab = "general" | "store" | "delivery" | "payment" | "notifications";

const tabList: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "store", label: "Store", icon: Store },
  { id: "delivery", label: "Delivery", icon: Truck },
  { id: "payment", label: "Payment", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
];

// ── Feature toggles, grouped so Email and SMS each get their own section ──
interface FeatureToggle { key: string; label: string; desc: string; def: boolean }

const GENERAL_FEATURES: FeatureToggle[] = [
  { key: "public_reviews", label: "Open Reviews on Product Pages", desc: "When on, the “Write a Review” form on product pages is open to everyone — logged-in customers AND unregistered visitors (guests show a generated guest name). When off, the product-page form is hidden for everyone and customers review from their Profile → Reviews instead. All submissions still need your approval.", def: false },
  { key: "wishlist", label: "Wishlist", desc: "Let customers save products for later", def: true },
  { key: "preorders", label: "Pre-orders", desc: "Accept orders for out-of-stock products", def: true },
  { key: "guest_checkout", label: "Guest Checkout", desc: "Allow checkout without creating an account", def: true },
];

const EMAIL_FEATURES: FeatureToggle[] = [
  { key: "order_email_customer", label: "Order Confirmation — Customer", desc: "Email the customer a branded order-confirmation on every new order (only if they have an email on file). Requires email configured (RESEND_API_KEY/EMAIL_FROM).", def: false },
  { key: "order_email_admin", label: "New Order — Admin", desc: "Email the admin recipient(s) (set below in Notifications) on every new order with the order + customer details. Requires email configured.", def: false },
  { key: "order_email_shipped", label: "Shipped Update — Customer", desc: "Email the customer when you mark their order Shipped. Requires email configured + a customer email on the order.", def: false },
  { key: "order_email_delivered", label: "Delivered Update — Customer", desc: "Email the customer when you mark their order Delivered. Requires email configured + a customer email on the order.", def: false },
  { key: "reset_otp_email", label: "Password Reset OTP via Email", desc: "Allow customers to receive their forgot-password code by email. Requires email configured. (When both this and the SMS option are off, self-service password reset is disabled.)", def: false },
];

const SMS_FEATURES: FeatureToggle[] = [
  { key: "order_sms_customer", label: "Order Confirmation — Customer", desc: "Text the customer an order-confirmation on every new order (order number, amount, payment, date/time) with a track-order link. Requires SMS gateway credit.", def: false },
  { key: "order_sms_admin", label: "New Order — Admin", desc: "Text the admin number(s) (set below in Notifications) on every new order with the order details plus the customer's name, tier and phone. Requires SMS gateway credit.", def: false },
  { key: "reset_otp_sms", label: "Password Reset OTP via SMS", desc: "Allow customers to receive their forgot-password code by SMS. Requires SMS gateway credit. (When both this and the Email option are off, self-service password reset is disabled.)", def: false },
];

function renderFeatureToggle(
  f: FeatureToggle,
  features: Record<string, boolean>,
  setFeatures: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
) {
  return (
    <div key={f.key} className="flex items-center justify-between">
      <p className="text-sm font-medium text-charcoal"><FieldLabel label={f.label} hint={f.desc} /></p>
      <Switch checked={features[f.key] ?? f.def} onCheckedChange={() => setFeatures((p) => ({ ...p, [f.key]: !(p[f.key] ?? f.def) }))} />
    </div>
  );
}

/** Read-only summary card with a single Edit button that opens a section modal.
 *  Used across Settings so the landing is view-only and edits happen in modals. */
function SectionCard({ title, description, icon: Icon, canEdit = true, onEdit, children }: {
  title: string; description?: string; icon?: React.ComponentType<{ className?: string }>;
  canEdit?: boolean; onEdit: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-luxury border border-border/40 bg-card shadow-card">
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-border/20">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-charcoal flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-secondary" />} {title}
          </h3>
          {description && <p className="text-xs text-charcoal-lighter mt-0.5">{description}</p>}
        </div>
        {canEdit && (
          <AdminButton variant="outline" size="sm" onClick={onEdit} className="shrink-0"><Edit className="h-3.5 w-3.5 mr-1" /> Edit</AdminButton>
        )}
      </div>
      <div className="p-4 sm:p-5 space-y-2.5">{children}</div>
    </div>
  );
}

/** Modal that holds a settings section's edit form + a Save button inside it.
 *  Save runs the section's async save handler (which persists to the server). */
function SectionEditDialog({ open, title, saving, saved, onClose, onSave, children, maxWidth = "max-w-lg" }: {
  open: boolean; title: string; saving?: boolean; saved?: boolean;
  onClose: () => void; onSave: () => void | Promise<void>; children: React.ReactNode; maxWidth?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className={cn("w-[95vw] max-h-[90vh] flex flex-col overflow-hidden", maxWidth)}>
        <DialogHeader className="shrink-0"><DialogTitle>Edit {title}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-1 pr-1">{children}</div>
        <DialogFooter className="shrink-0 pt-2">
          <AdminButton variant="outline" onClick={onClose} disabled={saving}>Cancel</AdminButton>
          <AdminButton onClick={onSave} disabled={saving} className={cn(saved && "!bg-success hover:!bg-success")}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving...</> : saved ? <><Check className="h-3.5 w-3.5 mr-1" /> Saved!</> : <><Save className="h-3.5 w-3.5 mr-1" /> Save</>}
          </AdminButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One read-only "label: value" row for a SectionCard summary. */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-charcoal-lighter shrink-0">{label}</span>
      <span className="text-charcoal font-medium text-right min-w-0 break-words">{value || <span className="text-charcoal-lighter italic font-normal">Not set</span>}</span>
    </div>
  );
}

/** A read-only on/off row for a feature/toggle summary. */
function ToggleRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-charcoal">{label}</span>
      <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0", on ? "bg-success/10 text-success" : "bg-charcoal-lighter/10 text-charcoal-lighter")}>{on ? "On" : "Off"}</span>
    </div>
  );
}

interface ApplicableItem { id: string; name: string; extra?: string }

/** Applicability picker shared by the free standard/express delivery rules — same model as offers/coupons. */
function DeliveryApplicabilityPicker({
  applicability, onApplicabilityChange, selectedIds, onToggleSelected, onRemoveSelected,
  options, searchQuery, onSearch, searchResults, searchLoading,
}: {
  applicability: OfferApplicability;
  onApplicabilityChange: (v: OfferApplicability) => void;
  selectedIds: ApplicableItem[];
  onToggleSelected: (item: ApplicableItem) => void;
  onRemoveSelected: (id: string) => void;
  options: ApplicableItem[];
  searchQuery: string;
  onSearch: (q: string) => void;
  searchResults: ApplicableItem[];
  searchLoading: boolean;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-charcoal-light mb-1.5">Applies To</label>
        <Select value={applicability} onValueChange={(v) => onApplicabilityChange(v as OfferApplicability)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="store"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Store-wide</span></SelectItem>
            <SelectItem value="categories"><span className="flex items-center gap-2"><FolderTree className="h-3.5 w-3.5" /> Specific Categories</span></SelectItem>
            <SelectItem value="subcategories"><span className="flex items-center gap-2"><FolderTree className="h-3.5 w-3.5" /> Specific Subcategories</span></SelectItem>
            <SelectItem value="products"><span className="flex items-center gap-2"><ShoppingCart className="h-3.5 w-3.5" /> Specific Products</span></SelectItem>
            <SelectItem value="brands"><span className="flex items-center gap-2"><Award className="h-3.5 w-3.5" /> Specific Brands</span></SelectItem>
            <SelectItem value="customers"><span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Specific Customers</span></SelectItem>
            <SelectItem value="tiers"><span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Membership Tiers</span></SelectItem>
          </SelectContent>
        </Select>
      </div>

      {applicability !== "store" && (
        <div className="space-y-2">
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedIds.map((item) => (
                <span key={item.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary text-[11px] font-medium">
                  {item.name}
                  <button type="button" onClick={() => onRemoveSelected(item.id)} className="hover:text-destructive transition-colors active:scale-[0.96]">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {(applicability === "customers" || applicability === "products") && (
            <div>
              <div className="flex items-center gap-2 px-3 rounded-xl border border-border bg-pearl/30">
                <Search className="h-3.5 w-3.5 text-charcoal-lighter shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder={applicability === "customers" ? "Search by phone number..." : "Search by product name or SKU..."}
                  className="w-full py-2.5 text-sm bg-transparent outline-none text-charcoal placeholder:text-charcoal-lighter/50"
                />
                {searchLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-charcoal-lighter shrink-0" />}
              </div>
              {searchResults.length > 0 && (
                <div className="mt-1 max-h-36 overflow-y-auto border border-border/30 rounded-lg bg-card">
                  {searchResults.map((r) => {
                    const isSelected = selectedIds.some((s) => s.id === r.id);
                    return (
                      <button key={r.id} type="button" onClick={() => onToggleSelected(r)}
                        className={cn("w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-pearl transition-colors", isSelected && "bg-secondary/5")}>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-charcoal truncate">{r.name}</p>
                          <p className="text-[10px] text-charcoal-lighter truncate">{r.extra}</p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-secondary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {(applicability === "categories" || applicability === "subcategories" || applicability === "tiers" || applicability === "brands") && (
            <div className="max-h-44 overflow-y-auto border border-border/30 rounded-lg bg-card">
              {options.length === 0 ? (
                <p className="px-3 py-4 text-xs text-charcoal-lighter text-center">No {applicability} found</p>
              ) : options.map((opt) => {
                const isSelected = selectedIds.some((s) => s.id === opt.id);
                return (
                  <button key={opt.id} type="button" onClick={() => onToggleSelected(opt)}
                    className={cn("w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-pearl transition-colors border-b border-border/10 last:border-0", isSelected && "bg-secondary/5")}>
                    <span className="text-xs text-charcoal">{opt.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-secondary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PaymentMethod {
  id: string; name: string; enabled: boolean; account_number: string; instructions: string; qr_image: string; icon: string;
  input_type: "transaction_id" | "phone_number";
}

export default function AdminSettingsPage() {
  return (
    <Suspense>
      <AdminSettingsPageInner />
    </Suspense>
  );
}

function AdminSettingsPageInner() {
  const flushUploads = useFlushUploads();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(requestedTab && tabList.some((t) => t.id === requestedTab) ? requestedTab : "general");
  const [loading, setLoading] = useState(true);

  // ═══ GENERAL ═══
  const [storeName, setStoreName] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [features, setFeatures] = useState<Record<string, boolean>>({
    wishlist: true, preorders: true, guest_checkout: true,
    // Defaults OFF — opt-in features.
    public_reviews: false, order_sms_customer: false, order_sms_admin: false,
  });
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);
  // Per-section edit modals (view-only landing; Edit opens a modal that saves).
  const [storeInfoDialog, setStoreInfoDialog] = useState(false);
  const [featuresDialog, setFeaturesDialog] = useState(false);
  const [emailFeatDialog, setEmailFeatDialog] = useState(false);
  const [smsFeatDialog, setSmsFeatDialog] = useState(false);

  // ═══ STORE ═══
  const [storeLogo, setStoreLogo] = useState("");
  // Tracks the last PERSISTED store-logo URL (not the staged blob preview), so a
  // replaced logo's old file can be deleted after a successful save.
  const savedLogoRef = useRef<string>("");
  const [ourStory, setOurStory] = useState<OurStoryContent>(DEFAULT_OUR_STORY);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [instagramPosts, setInstagramPosts] = useState<InstagramPost[]>([]);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [socialLinks, setSocialLinks] = useState<{ platform: string; url: string }[]>([]);
  const [addSocialOpen, setAddSocialOpen] = useState(false);
  const [newSocialPlatform, setNewSocialPlatform] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [storeSaving, setStoreSaving] = useState(false);
  const [storeSaved, setStoreSaved] = useState(false);
  // Store tab: per-section edit modals.
  const [brandingDialog, setBrandingDialog] = useState(false);
  const [ourStoryDialog, setOurStoryDialog] = useState(false);
  const [instagramDialog, setInstagramDialog] = useState(false);
  const [faqDialog, setFaqDialog] = useState(false);
  const [maintenanceDialog, setMaintenanceDialog] = useState(false);

  // ═══ DELIVERY ═══
  const delivery = useDeliveryStore();
  const [mounted, setMounted] = useState(false);
  const [thresholdInput, setThresholdInput] = useState("");
  const [expressChargeInput, setExpressChargeInput] = useState("");
  const [zoneDialog, setZoneDialog] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [zoneAreas, setZoneAreas] = useState("");
  const [zoneCharge, setZoneCharge] = useState("");
  const [zoneDays, setZoneDays] = useState("");
  const [editZoneId, setEditZoneId] = useState<string | null>(null);
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [deliverySaved, setDeliverySaved] = useState(false);
  const [freeDeliveryDialog, setFreeDeliveryDialog] = useState(false);
  const [expressDialog, setExpressDialog] = useState(false);

  // Free delivery rules — applicability-scoped the same way as offers/coupons.
  // One rule for standard delivery, one for express, each independently on/off.
  const [standardRuleActive, setStandardRuleActive] = useState(false);
  const [standardApplicability, setStandardApplicability] = useState<OfferApplicability>("store");
  const [standardSelectedIds, setStandardSelectedIds] = useState<ApplicableItem[]>([]);
  const [expressRuleActive, setExpressRuleActive] = useState(false);
  const [expressApplicability, setExpressApplicability] = useState<OfferApplicability>("store");
  const [expressSelectedIds, setExpressSelectedIds] = useState<ApplicableItem[]>([]);
  const [deliveryRulesLoaded, setDeliveryRulesLoaded] = useState(false);
  const [allCategoriesForDelivery, setAllCategoriesForDelivery] = useState<{ id: string; name: string; children?: { id: string; name: string }[] }[]>([]);
  const [allTiersForDelivery, setAllTiersForDelivery] = useState<{ id: string; name: string }[]>([]);
  const [allBrandsForDelivery, setAllBrandsForDelivery] = useState<{ id: string; name: string }[]>([]);
  const [ruleSearchQuery, setRuleSearchQuery] = useState("");
  const [ruleSearchResults, setRuleSearchResults] = useState<ApplicableItem[]>([]);
  const [ruleSearchLoading, setRuleSearchLoading] = useState(false);

  // ═══ PAYMENT ═══
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { id: "COD", name: "Cash on Delivery", enabled: true, account_number: "", instructions: "Pay when you receive", qr_image: "", icon: "", input_type: "transaction_id" },
    { id: "bkash", name: "bKash", enabled: true, account_number: "", instructions: "", qr_image: "", icon: "", input_type: "transaction_id" },
    { id: "nagad", name: "Nagad", enabled: true, account_number: "", instructions: "", qr_image: "", icon: "", input_type: "transaction_id" },
    { id: "rocket", name: "Rocket", enabled: false, account_number: "", instructions: "", qr_image: "", icon: "", input_type: "transaction_id" },
    { id: "card", name: "Card Payment", enabled: false, account_number: "", instructions: "", qr_image: "", icon: "", input_type: "transaction_id" },
  ]);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [newPaymentName, setNewPaymentName] = useState("");
  // Payment: add + per-method edit modals (view-only list).
  const [addPaymentDialog, setAddPaymentDialog] = useState(false);
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);

  // ═══ NOTIFICATIONS ═══
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    order_placed: true, order_confirmed: true, order_shipped: true, order_delivered: true, order_cancelled: true,
    return_requested: true, return_approved: true, low_stock_alert: true, new_review: true, new_customer: true,
    points_earned: true, promo_offers: false,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // ═══ SMS GATEWAY ═══
  const [smsBalance, setSmsBalance] = useState<number | null>(null);
  const [smsBalanceError, setSmsBalanceError] = useState("");
  const [smsBalanceLoading, setSmsBalanceLoading] = useState(false);

  // Order-SMS admin recipients (which admin numbers receive the order SMS).
  const [adminPhones, setAdminPhones] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [orderSmsAdminIds, setOrderSmsAdminIds] = useState<string[]>([]);
  const [orderSmsSaving, setOrderSmsSaving] = useState(false);
  const [orderSmsSaved, setOrderSmsSaved] = useState(false);
  // Order-email admin recipients — free-text emails (not tied to admin phones).
  const [orderEmailAdmins, setOrderEmailAdmins] = useState("");
  const [orderEmailSaving, setOrderEmailSaving] = useState(false);
  const [orderEmailSaved, setOrderEmailSaved] = useState(false);
  // Edit-in-modal state for the order-email recipients.
  const [orderEmailDialog, setOrderEmailDialog] = useState(false);
  const [orderEmailDraft, setOrderEmailDraft] = useState("");
  const [orderEmailError, setOrderEmailError] = useState("");
  // Email footer — plain text shown at the bottom of EVERY email, above the
  // fixed ChineXa logo.
  const [emailFooter, setEmailFooter] = useState("");
  const [emailFooterSaving, setEmailFooterSaving] = useState(false);
  const [emailFooterSaved, setEmailFooterSaved] = useState(false);
  // Notifications tab: per-section edit modals.
  const [orderSmsDialog, setOrderSmsDialog] = useState(false);
  const [emailFooterDialog, setEmailFooterDialog] = useState(false);
  const [notifDialog, setNotifDialog] = useState<null | "Order Notifications" | "Returns & Alerts">(null);

  const fetchSmsBalance = async () => {
    setSmsBalanceLoading(true);
    setSmsBalanceError("");
    try {
      const res = await fetch("/api/sms/balance");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch SMS balance");
      setSmsBalance(data.balance);
    } catch (err: unknown) {
      setSmsBalanceError(err instanceof Error ? err.message : "Failed to fetch SMS balance");
    } finally {
      setSmsBalanceLoading(false);
    }
  };

  // ═══ LOAD ALL ═══
  useEffect(() => {
    setMounted(true);
    // Order-SMS recipients: available admin phones + the currently-selected ids.
    fetch("/api/admin/phones").then((r) => r.ok ? r.json() : []).then((d) => { if (Array.isArray(d)) setAdminPhones(d); }).catch(() => {});
    fetch("/api/settings?key=order_sms").then((r) => r.json()).then((d) => {
      const ids = d?.value?.admin_ids;
      if (Array.isArray(ids)) setOrderSmsAdminIds(ids.filter((x: unknown): x is string => typeof x === "string"));
    }).catch(() => {});
    fetch("/api/settings?key=order_email").then((r) => r.json()).then((d) => {
      const emails = d?.value?.admin_emails;
      if (Array.isArray(emails)) setOrderEmailAdmins(emails.filter((x: unknown): x is string => typeof x === "string").join(", "));
    }).catch(() => {});

    fetch("/api/settings?key=email_footer").then((r) => r.json()).then((d) => {
      if (typeof d?.value === "string") setEmailFooter(d.value);
    }).catch(() => {});

    fetch("/api/settings?keys=store_name,store_email,store_phone,store_address,features,store_logo,our_story,instagram_feed,faq_items,social_links,maintenance_mode,delivery_config,payment_methods,notification_settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.store_name) setStoreName(data.store_name);
        if (data.store_email) setStoreEmail(data.store_email);
        if (data.store_phone) setStorePhone(data.store_phone);
        if (data.store_address) setStoreAddress(data.store_address);
        if (data.features) setFeatures((p) => ({ ...p, ...data.features }));
        if (data.store_logo) { setStoreLogo(data.store_logo); savedLogoRef.current = data.store_logo; }
        if (data.our_story) setOurStory({ ...DEFAULT_OUR_STORY, ...data.our_story });
        if (data.instagram_feed) {
          setInstagramHandle(data.instagram_feed.handle || "");
          if (Array.isArray(data.instagram_feed.posts)) setInstagramPosts(data.instagram_feed.posts);
        }
        if (Array.isArray(data.faq_items)) setFaqItems(data.faq_items);
        if (data.social_links) {
          if (Array.isArray(data.social_links)) {
            setSocialLinks(data.social_links);
          } else {
            // Convert old object format to array
            const links: { platform: string; url: string }[] = [];
            for (const [key, val] of Object.entries(data.social_links)) {
              if (val) links.push({ platform: key, url: val as string });
            }
            setSocialLinks(links);
          }
        }
        if (data.maintenance_mode !== undefined) setMaintenanceMode(!!data.maintenance_mode);
        if (data.delivery_config) {
          const cfg = data.delivery_config;
          if (cfg.freeDeliveryEnabled !== undefined) delivery.setFreeDelivery(cfg.freeDeliveryEnabled);
          if (cfg.freeDeliveryThreshold) { delivery.setFreeDeliveryThreshold(cfg.freeDeliveryThreshold); setThresholdInput(String(cfg.freeDeliveryThreshold)); }
          if (cfg.expressEnabled !== undefined) delivery.setExpressEnabled(cfg.expressEnabled);
          if (cfg.expressCharge !== undefined) { delivery.setExpressCharge(cfg.expressCharge); setExpressChargeInput(String(cfg.expressCharge)); }
          if (cfg.expressDivision) delivery.setExpressDivision(cfg.expressDivision);
        }
        if (data.payment_methods && Array.isArray(data.payment_methods)) {
          setPaymentMethods(data.payment_methods.map((m: Partial<PaymentMethod>) => ({
            id: m.id || randomId(), name: m.name || "", enabled: !!m.enabled,
            account_number: m.account_number || "", instructions: m.instructions || "", qr_image: m.qr_image || "", icon: m.icon || "",
            input_type: m.input_type === "phone_number" ? "phone_number" : "transaction_id",
          })));
        }
        if (data.notification_settings) setNotifications((p) => ({ ...p, ...data.notification_settings }));
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setThresholdInput(String(delivery.freeDeliveryThreshold));
        setExpressChargeInput(String(delivery.expressCharge));
      });

    // Free delivery rules (separate table, own endpoint)
    fetch("/api/delivery-rules")
      .then((r) => r.json())
      .then((rules) => {
        if (!Array.isArray(rules)) return;
        for (const rule of rules) {
          const selected = (rule.applicable_ids || []).map((id: string, i: number) => ({ id, name: rule.applicable_names?.[i] || id }));
          if (rule.rule_type === "standard") {
            setStandardRuleActive(!!rule.is_active);
            setStandardApplicability(rule.applicability || "store");
            setStandardSelectedIds(selected);
          } else if (rule.rule_type === "express") {
            setExpressRuleActive(!!rule.is_active);
            setExpressApplicability(rule.applicability || "store");
            setExpressSelectedIds(selected);
          }
        }
      })
      .catch(() => {})
      .finally(() => setDeliveryRulesLoaded(true));

    fetch("/api/categories").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setAllCategoriesForDelivery(data); }).catch(() => {});
    fetch("/api/membership/tiers").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setAllTiersForDelivery(data.map((t: Record<string, unknown>) => ({ id: t.id as string, name: t.name as string })));
    }).catch(() => {});
    fetch("/api/brands").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setAllBrandsForDelivery(data.map((b: Record<string, unknown>) => ({ id: b.id as string, name: b.name as string })));
    }).catch(() => {});
  }, []);

  const getDeliveryRuleOptions = (applicability: OfferApplicability) => {
    if (applicability === "categories") return allCategoriesForDelivery.map((c) => ({ id: c.id, name: c.name }));
    if (applicability === "subcategories") return allCategoriesForDelivery.flatMap((c) => (c.children || []).map((s) => ({ id: s.id, name: `${c.name} → ${s.name}` })));
    if (applicability === "tiers") return allTiersForDelivery;
    if (applicability === "brands") return allBrandsForDelivery;
    return [];
  };

  const handleRuleSearch = async (applicability: OfferApplicability, q: string) => {
    setRuleSearchQuery(q);
    if (q.length < 2) { setRuleSearchResults([]); return; }
    setRuleSearchLoading(true);
    try {
      if (applicability === "customers") {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}&page_size=10`);
        const data = await res.json();
        if (data?.data) setRuleSearchResults(data.data.map((c: Record<string, unknown>) => ({ id: c.id as string, name: c.name as string, extra: c.phone as string })));
      } else if (applicability === "products") {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&all=1&page_size=10`);
        const data = await res.json();
        if (data?.data) setRuleSearchResults(data.data.map((p: Record<string, unknown>) => ({ id: p.id as string, name: p.name as string, extra: p.sku as string })));
      }
    } catch {} finally { setRuleSearchLoading(false); }
  };

  const saveDeliveryRule = async (ruleType: "standard" | "express") => {
    const isActive = ruleType === "standard" ? standardRuleActive : expressRuleActive;
    const applicability = ruleType === "standard" ? standardApplicability : expressApplicability;
    const selectedIds = ruleType === "standard" ? standardSelectedIds : expressSelectedIds;
    await fetch("/api/delivery-rules", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rule_type: ruleType,
        is_active: isActive,
        applicability,
        applicable_ids: applicability === "store" ? [] : selectedIds.map((s) => s.id),
      }),
    });
  };

  // ═══ SAVE HELPERS ═══
  const saveSettings = async (keys: Record<string, unknown>, setSaving: (v: boolean) => void, setSaved: (v: boolean) => void) => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(keys)) {
        await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
      }
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch {} finally { setSaving(false); }
  };

  const saveGeneral = () => saveSettings({ store_name: storeName, store_email: storeEmail, store_phone: storePhone, store_address: storeAddress, features }, setGeneralSaving, setGeneralSaved);
  const saveStoreSettings = async () => {
    // Upload any staged (cropped, not-yet-uploaded) images now.
    const uploaded = await flushUploads();
    const resolvedLogo = uploaded.store_logo ?? storeLogo;
    const resolvedStoryImage = uploaded.our_story_image ?? ourStory.image;
    const resolvedPosts = instagramPosts.map((post, i) => ({
      ...post,
      image: uploaded[`instagram_image_${i}`] ?? post.image,
    }));
    await saveSettings({
      store_logo: resolvedLogo, our_story: { ...ourStory, image: resolvedStoryImage },
      instagram_feed: { handle: instagramHandle, posts: resolvedPosts },
      faq_items: faqItems,
      social_links: socialLinks, maintenance_mode: maintenanceMode,
    }, setStoreSaving, setStoreSaved);
    // Logo replaced → remove the previously-persisted file.
    if (savedLogoRef.current !== resolvedLogo) {
      await cleanupReplacedImage(savedLogoRef.current, resolvedLogo || null);
      savedLogoRef.current = resolvedLogo || "";
    }
  };

  // ─── Our Story helpers ───
  const updateStory = (patch: Partial<OurStoryContent>) => setOurStory((s) => ({ ...s, ...patch }));
  const updateParagraph = (i: number, text: string) => setOurStory((s) => ({ ...s, paragraphs: s.paragraphs.map((p, idx) => (idx === i ? text : p)) }));
  const addParagraph = () => setOurStory((s) => ({ ...s, paragraphs: [...s.paragraphs, ""] }));
  const removeParagraph = (i: number) => setOurStory((s) => ({ ...s, paragraphs: s.paragraphs.filter((_, idx) => idx !== i) }));

  // ─── Instagram feed helpers ───
  const addInstagramPost = () => setInstagramPosts((p) => [...p, { id: randomId(), image: "", link: "" }]);
  const updateInstagramPost = (i: number, patch: Partial<InstagramPost>) => setInstagramPosts((p) => p.map((post, idx) => (idx === i ? { ...post, ...patch } : post)));
  const removeInstagramPost = (i: number) => setInstagramPosts((p) => p.filter((_, idx) => idx !== i));

  // ─── FAQ helpers ───
  const addFaqItem = () => setFaqItems((f) => [...f, { question: "", answer: "" }]);
  const updateFaqItem = (i: number, patch: Partial<FaqItem>) => setFaqItems((f) => f.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  const removeFaqItem = (i: number) => setFaqItems((f) => f.filter((_, idx) => idx !== i));

  const updateValue = (i: number, patch: Partial<OurStoryValue>) => setOurStory((s) => ({ ...s, values: s.values.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) }));
  const addValue = () => setOurStory((s) => ({ ...s, values: [...s.values, { icon: "Sparkles", title: "", description: "" }] }));
  const removeValue = (i: number) => setOurStory((s) => ({ ...s, values: s.values.filter((_, idx) => idx !== i) }));

  const updateStat = (i: number, patch: Partial<OurStoryStat>) => setOurStory((s) => ({ ...s, stats: s.stats.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) }));
  const addStat = () => setOurStory((s) => ({ ...s, stats: [...s.stats, { value: "", label: "" }] }));
  const removeStat = (i: number) => setOurStory((s) => ({ ...s, stats: s.stats.filter((_, idx) => idx !== i) }));
  const saveDelivery = async () => {
    const val = Number(thresholdInput);
    if (val > 0) delivery.setFreeDeliveryThreshold(val);
    const expressVal = Number(expressChargeInput);
    if (expressVal >= 0 && expressChargeInput !== "") delivery.setExpressCharge(expressVal);
    setDeliverySaving(true);
    try {
      await Promise.all([
        fetch("/api/settings", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: "delivery_config",
            value: {
              freeDeliveryEnabled: delivery.freeDeliveryEnabled,
              freeDeliveryThreshold: val || delivery.freeDeliveryThreshold,
              zones: delivery.zones,
              partners: delivery.partners,
              expressEnabled: delivery.expressEnabled,
              expressCharge: expressVal >= 0 && expressChargeInput !== "" ? expressVal : delivery.expressCharge,
              expressDivision: delivery.expressDivision,
            },
          }),
        }),
        fetch("/api/settings", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "free_delivery_enabled", value: delivery.freeDeliveryEnabled }),
        }),
        fetch("/api/settings", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "free_delivery_threshold", value: val || delivery.freeDeliveryThreshold }),
        }),
        saveDeliveryRule("standard"),
        saveDeliveryRule("express"),
      ]);
      setDeliverySaved(true); setTimeout(() => setDeliverySaved(false), 3000);
    } catch {} finally { setDeliverySaving(false); }
  };
  const savePayment = async () => {
    // Upload any staged (cropped, not-yet-uploaded) images now.
    const uploaded = await flushUploads();
    const resolvedMethods = paymentMethods.map((m) => ({
      ...m,
      icon: uploaded[`payment_icon_${m.id}`] ?? m.icon,
      qr_image: uploaded[`payment_qr_${m.id}`] ?? m.qr_image,
    }));
    await saveSettings({ payment_methods: resolvedMethods }, setPaymentSaving, setPaymentSaved);
  };
  const saveNotifications = () => saveSettings({ notification_settings: notifications }, setNotifSaving, setNotifSaved);
  const saveOrderSmsRecipients = () => saveSettings({ order_sms: { admin_ids: orderSmsAdminIds } }, setOrderSmsSaving, setOrderSmsSaved);
  const saveEmailFooter = () => saveSettings({ email_footer: emailFooter }, setEmailFooterSaving, setEmailFooterSaved);
  const toggleOrderSmsAdmin = (id: string) => setOrderSmsAdminIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  // Save the recipients edited in the modal. Unlike saveSettings (which
  // swallows errors), this surfaces a real success/failure so the setting can't
  // silently fail to store — it PUTs, verifies res.ok, updates the displayed
  // value only on success, and keeps the modal open with an error otherwise.
  const saveOrderEmailRecipients = async () => {
    const emails = orderEmailDraft.split(",").map((e) => e.trim()).filter(Boolean);
    const invalid = emails.filter((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    if (invalid.length) {
      setOrderEmailError(`Invalid email${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}`);
      return;
    }
    setOrderEmailSaving(true);
    setOrderEmailError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "order_email", value: { admin_emails: emails } }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setOrderEmailError(d.error || (res.status === 403 ? "You don't have permission to change this." : "Could not save. Please try again."));
        return;
      }
      setOrderEmailAdmins(emails.join(", "));
      setOrderEmailSaved(true);
      setTimeout(() => setOrderEmailSaved(false), 3000);
      setOrderEmailDialog(false);
    } catch {
      setOrderEmailError("Network error. Please try again.");
    } finally {
      setOrderEmailSaving(false);
    }
  };

  const openOrderEmailDialog = () => {
    setOrderEmailDraft(orderEmailAdmins);
    setOrderEmailError("");
    setOrderEmailDialog(true);
  };


  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-charcoal">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-pearl/60 p-1 rounded-lg overflow-x-auto">
        {tabList.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all active:scale-[0.97]", activeTab === tab.id ? "bg-card text-charcoal shadow-card" : "text-charcoal-lighter hover:text-charcoal")}>
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ GENERAL ═══ */}
      {activeTab === "general" && (
        <div className="space-y-5">
          <div className="grid lg:grid-cols-2 gap-5">
            <SectionCard title="Store Information" description="Basic contact details" onEdit={() => setStoreInfoDialog(true)}>
              <Row label="Store Name" value={storeName} />
              <Row label="Contact Email" value={storeEmail} />
              <Row label="Contact Phone" value={storePhone} />
              <Row label="Store Address" value={storeAddress} />
              <Row label="Currency" value="BDT (৳)" />
            </SectionCard>
            <SectionCard title="Features" description="Toggle store features" onEdit={() => setFeaturesDialog(true)}>
              {GENERAL_FEATURES.map((f) => <ToggleRow key={f.key} label={f.label} on={features[f.key] ?? f.def} />)}
            </SectionCard>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <SectionCard title="Email Notifications" description="Order + verification emails (needs RESEND_API_KEY / EMAIL_FROM)" icon={Mail} onEdit={() => setEmailFeatDialog(true)}>
              {EMAIL_FEATURES.map((f) => <ToggleRow key={f.key} label={f.label} on={features[f.key] ?? f.def} />)}
            </SectionCard>
            <SectionCard title="SMS Notifications" description="Order + verification SMS (needs SMS gateway credit)" icon={MessageSquare} onEdit={() => setSmsFeatDialog(true)}>
              {SMS_FEATURES.map((f) => <ToggleRow key={f.key} label={f.label} on={features[f.key] ?? f.def} />)}
            </SectionCard>
          </div>

          {/* Store Information modal */}
          <SectionEditDialog open={storeInfoDialog} title="Store Information" saving={generalSaving} saved={generalSaved} onClose={() => setStoreInfoDialog(false)} onSave={async () => { await saveGeneral(); setStoreInfoDialog(false); }}>
            <Input label="Store Name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
            <Input label="Contact Email" value={storeEmail} onChange={(e) => setStoreEmail(e.target.value)} type="email" />
            <Input label="Contact Phone" value={storePhone} onChange={(e) => setStorePhone(e.target.value)} />
            <Textarea label="Store Address" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} />
            <Input label="Currency" value="BDT (৳)" disabled />
          </SectionEditDialog>

          {/* Features modal */}
          <SectionEditDialog open={featuresDialog} title="Features" saving={generalSaving} saved={generalSaved} onClose={() => setFeaturesDialog(false)} onSave={async () => { await saveGeneral(); setFeaturesDialog(false); }}>
            {GENERAL_FEATURES.map((f) => renderFeatureToggle(f, features, setFeatures))}
          </SectionEditDialog>

          {/* Email notifications modal */}
          <SectionEditDialog open={emailFeatDialog} title="Email Notifications" saving={generalSaving} saved={generalSaved} onClose={() => setEmailFeatDialog(false)} onSave={async () => { await saveGeneral(); setEmailFeatDialog(false); }}>
            {EMAIL_FEATURES.map((f) => renderFeatureToggle(f, features, setFeatures))}
          </SectionEditDialog>

          {/* SMS notifications modal */}
          <SectionEditDialog open={smsFeatDialog} title="SMS Notifications" saving={generalSaving} saved={generalSaved} onClose={() => setSmsFeatDialog(false)} onSave={async () => { await saveGeneral(); setSmsFeatDialog(false); }}>
            {SMS_FEATURES.map((f) => renderFeatureToggle(f, features, setFeatures))}
          </SectionEditDialog>
        </div>
      )}

      {/* ═══ STORE ═══ */}
      {activeTab === "store" && (
        <div className="space-y-5">
          <div className="grid lg:grid-cols-2 gap-5">
            {/* Branding — read-only summary */}
            <SectionCard title="Branding" onEdit={() => setBrandingDialog(true)}>
              <div className="flex items-center gap-3">
                {storeLogo ? <img src={storeLogo} alt="Store logo" className="h-14 w-14 rounded-lg object-contain border border-border/30 bg-white" /> : <span className="text-sm text-charcoal-lighter italic">No logo set</span>}
                <span className="text-xs text-charcoal-lighter">Store logo</span>
              </div>
            </SectionCard>

            <div className="space-y-5">
              {/* Social Links — read-only summary (edit via its own add/remove modal) */}
              <SectionCard title="Social Links" onEdit={() => setAddSocialOpen(true)} canEdit={false}>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {socialLinks.length === 0 ? <span className="text-xs text-charcoal-lighter italic">None added</span> : socialLinks.map((link, i) => {
                      const platform = getPlatform(link.platform);
                      return (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-pearl text-[11px] text-charcoal">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full shrink-0 text-white text-[8px]" style={{ backgroundColor: platform?.color || "#666" }}>{platform?.name?.[0] || link.platform[0]?.toUpperCase()}</span>
                          {platform?.name || link.platform}
                          <button onClick={() => { setSocialLinks((prev) => prev.filter((_, idx) => idx !== i)); saveStoreSettings(); }} className="hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                        </span>
                      );
                    })}
                  </div>
                  <AdminButton size="xs" variant="outline" onClick={() => setAddSocialOpen(true)} className="shrink-0 ml-2"><Plus className="h-3 w-3" /> Add</AdminButton>
                </div>
                {socialLinks.some((l) => !l.url) && <p className="text-[11px] text-warning">Some links have no URL — Edit to set them.</p>}
                {socialLinks.length > 0 && (
                  <AdminButton size="xs" variant="ghost" onClick={() => setBrandingDialog(true)} className="mt-1"><Edit className="h-3 w-3 mr-1" /> Edit URLs</AdminButton>
                )}
              </SectionCard>

              {/* Add Social Link Dialog */}
              <Dialog open={addSocialOpen} onOpenChange={setAddSocialOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Add Social Link</DialogTitle></DialogHeader>
                  <div className="py-2">
                    <label className="block text-sm font-medium text-charcoal-light mb-1.5">Select Platform</label>
                    <div className="grid grid-cols-3 gap-2">
                      {SOCIAL_PLATFORMS.filter((p) => !socialLinks.some((l) => l.platform === p.id)).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setNewSocialPlatform(p.id)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all active:scale-[0.96]",
                            newSocialPlatform === p.id ? "border-secondary bg-secondary/5 shadow-sm" : "border-border/30 hover:border-secondary/40"
                          )}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: p.color }}>
                            {p.whiteIcon}
                          </div>
                          <span className="text-[10px] font-medium text-charcoal">{p.name}</span>
                        </button>
                      ))}
                    </div>
                    {SOCIAL_PLATFORMS.filter((p) => !socialLinks.some((l) => l.platform === p.id)).length === 0 && (
                      <p className="text-xs text-charcoal-lighter text-center py-4">All platforms added</p>
                    )}
                  </div>
                  <DialogFooter>
                    <AdminButton variant="outline" size="sm" onClick={() => { setAddSocialOpen(false); setNewSocialPlatform(""); }}>Cancel</AdminButton>
                    <AdminButton size="sm" disabled={!newSocialPlatform} onClick={() => {
                      setSocialLinks((prev) => [...prev, { platform: newSocialPlatform, url: "" }]);
                      setAddSocialOpen(false); setNewSocialPlatform("");
                    }}><Plus className="h-3 w-3" /> Add Platform</AdminButton>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <SectionCard title="Maintenance Mode" description="Takes the storefront offline for all customers." onEdit={() => setMaintenanceDialog(true)}>
                <ToggleRow label="Maintenance mode" on={maintenanceMode} />
              </SectionCard>
              <Card><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-charcoal">Announcements</p><p className="text-[10px] text-charcoal-lighter">The top bar shown on every storefront page is now managed on its own page</p></div><Link href="/admin/announcements"><AdminButton variant="outline" size="sm"><Megaphone className="h-3.5 w-3.5" /> Open Announcements</AdminButton></Link></div></CardContent></Card>
            </div>
          </div>

          {/* Our Story — read-only summary; edit opens a modal with the full form */}
          <SectionCard title="Our Story" description="Shown on the homepage 'Our Story' section and the full /about page" icon={BookOpen} onEdit={() => setOurStoryDialog(true)}>
            <Row label="Heading" value={ourStory.heading} />
            <Row label="Paragraphs" value={`${ourStory.paragraphs.length}`} />
            <Row label="Values" value={`${ourStory.values.length}`} />
            <Row label="Stats" value={`${ourStory.stats.length}`} />
          </SectionCard>

          <SectionEditDialog open={ourStoryDialog} title="Our Story" saving={storeSaving} saved={storeSaved} maxWidth="max-w-2xl" onClose={() => setOurStoryDialog(false)} onSave={async () => { await saveStoreSettings(); setOurStoryDialog(false); }}>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Eyebrow" value={ourStory.eyebrow} onChange={(e) => updateStory({ eyebrow: e.target.value })} placeholder="Who We Are" />
                <Input label="Heading" value={ourStory.heading} onChange={(e) => updateStory({ heading: e.target.value })} placeholder="Beauty that speaks to your soul" />
              </div>
              <ImageUpload label="Story Image" value={ourStory.image} onChange={(v) => updateStory({ image: v })} aspectRatio="portrait" folder="general" field="our_story_image" />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-charcoal-light">Story Paragraphs</label>
                  <AdminButton size="xs" variant="outline" onClick={addParagraph}><Plus className="h-3 w-3" /> Add Paragraph</AdminButton>
                </div>
                <div className="space-y-2">
                  {ourStory.paragraphs.map((p, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Textarea value={p} onChange={(e) => updateParagraph(i, e.target.value)} className="min-h-[70px] flex-1" placeholder={`Paragraph ${i + 1}`} />
                      <button onClick={() => removeParagraph(i)} className="mt-2 p-1.5 rounded-md text-charcoal-lighter/50 hover:text-destructive hover:bg-destructive/5 transition-colors active:scale-[0.96] shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {ourStory.paragraphs.length === 0 && <p className="text-xs text-charcoal-lighter text-center py-3">No paragraphs yet</p>}
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-charcoal-light">Values Section</label>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 mb-3">
                  <Input label="Section Heading" value={ourStory.values_heading} onChange={(e) => updateStory({ values_heading: e.target.value })} />
                  <Input label="Section Subheading" value={ourStory.values_subheading} onChange={(e) => updateStory({ values_subheading: e.target.value })} />
                </div>
                <div className="space-y-2">
                  {ourStory.values.map((value, i) => {
                    const Icon = OUR_STORY_ICON_MAP[value.icon] || OUR_STORY_ICON_MAP.Sparkles;
                    return (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-border/30 bg-pearl/20">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light shrink-0 mt-0.5"><Icon className="h-4 w-4 text-secondary" /></div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="grid sm:grid-cols-[120px_1fr] gap-2">
                            <Select value={value.icon} onValueChange={(v) => updateValue(i, { icon: v as typeof value.icon })}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {OUR_STORY_ICON_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input value={value.title} onChange={(e) => updateValue(i, { title: e.target.value })} placeholder="Title" className="h-9" />
                          </div>
                          <Textarea value={value.description} onChange={(e) => updateValue(i, { description: e.target.value })} placeholder="Description" className="min-h-[60px]" />
                        </div>
                        <button onClick={() => removeValue(i)} className="p-1.5 rounded-md text-charcoal-lighter/50 hover:text-destructive hover:bg-destructive/5 transition-colors active:scale-[0.96] shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <AdminButton size="xs" variant="outline" className="mt-2" onClick={addValue}><Plus className="h-3 w-3" /> Add Value</AdminButton>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium text-charcoal-light mb-2 block">Stats Row</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ourStory.stats.map((stat, i) => (
                    <div key={i} className="relative p-3 rounded-lg border border-border/30 bg-pearl/20 space-y-2">
                      <button onClick={() => removeStat(i)} className="absolute top-2 right-2 p-0.5 text-charcoal-lighter/40 hover:text-destructive transition-colors active:scale-[0.96]">
                        <X className="h-3 w-3" />
                      </button>
                      <Input value={stat.value} onChange={(e) => updateStat(i, { value: e.target.value })} placeholder="300+" className="h-9 text-center font-semibold" />
                      <Input value={stat.label} onChange={(e) => updateStat(i, { label: e.target.value })} placeholder="Products" className="h-9 text-center text-xs" />
                    </div>
                  ))}
                </div>
                <AdminButton size="xs" variant="outline" className="mt-2" onClick={addStat}><Plus className="h-3 w-3" /> Add Stat</AdminButton>
              </div>
          </SectionEditDialog>

          {/* Instagram Feed — read-only summary; edit opens the full form modal */}
          <SectionCard title="Instagram Feed" description="Shown on the homepage 'Follow Our Journey' section — hidden if no posts" onEdit={() => setInstagramDialog(true)}>
            <Row label="Handle" value={instagramHandle} />
            <Row label="Posts" value={`${instagramPosts.length}`} />
          </SectionCard>

          <SectionEditDialog open={instagramDialog} title="Instagram Feed" saving={storeSaving} saved={storeSaved} maxWidth="max-w-2xl" onClose={() => setInstagramDialog(false)} onSave={async () => { await saveStoreSettings(); setInstagramDialog(false); }}>
              <Input label="Instagram Handle" value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="@chinexa.bd" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-charcoal-light">Posts</label>
                  <AdminButton size="xs" variant="outline" onClick={addInstagramPost}><Plus className="h-3 w-3" /> Add Post</AdminButton>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {instagramPosts.map((post, i) => (
                    <div key={post.id} className="relative p-3 rounded-lg border border-border/30 bg-pearl/20 space-y-2">
                      <button onClick={() => removeInstagramPost(i)} className="absolute top-2 right-2 z-10 p-1 rounded-md bg-white/90 text-charcoal-lighter/60 hover:text-destructive transition-colors active:scale-[0.96]">
                        <X className="h-3 w-3" />
                      </button>
                      <ImageUpload label="Image" value={post.image} onChange={(v) => updateInstagramPost(i, { image: v })} aspectRatio="square" folder="general" field={`instagram_image_${i}`} />
                      <Input value={post.link} onChange={(e) => updateInstagramPost(i, { link: e.target.value })} placeholder="Post URL (optional)" className="h-9" />
                    </div>
                  ))}
                  {instagramPosts.length === 0 && <p className="text-xs text-charcoal-lighter text-center py-3 sm:col-span-2 lg:col-span-3">No posts yet — the homepage section stays hidden until you add at least one.</p>}
                </div>
              </div>
          </SectionEditDialog>

          {/* FAQ — read-only summary; edit opens the full form modal */}
          <SectionCard title="FAQ" description="Shown on the homepage FAQ section — hidden if no questions" onEdit={() => setFaqDialog(true)}>
            <Row label="Questions" value={`${faqItems.length}`} />
          </SectionCard>

          <SectionEditDialog open={faqDialog} title="FAQ" saving={storeSaving} saved={storeSaved} maxWidth="max-w-2xl" onClose={() => setFaqDialog(false)} onSave={async () => { await saveStoreSettings(); setFaqDialog(false); }}>
              <div className="flex items-center justify-end">
                <AdminButton size="xs" variant="outline" onClick={addFaqItem}><Plus className="h-3 w-3" /> Add Question</AdminButton>
              </div>
              <div className="space-y-2">
                {faqItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-border/30 bg-pearl/20">
                    <div className="flex-1 min-w-0 space-y-2">
                      <Input value={item.question} onChange={(e) => updateFaqItem(i, { question: e.target.value })} placeholder="Question" className="h-9" />
                      <Textarea value={item.answer} onChange={(e) => updateFaqItem(i, { answer: e.target.value })} placeholder="Answer" className="min-h-[70px]" />
                    </div>
                    <button onClick={() => removeFaqItem(i)} className="mt-2 p-1.5 rounded-md text-charcoal-lighter/50 hover:text-destructive hover:bg-destructive/5 transition-colors active:scale-[0.96] shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {faqItems.length === 0 && <p className="text-xs text-charcoal-lighter text-center py-3">No questions yet — the homepage FAQ section stays hidden until you add at least one.</p>}
              </div>
          </SectionEditDialog>

          {/* Branding modal (logo + social link URLs) */}
          <SectionEditDialog open={brandingDialog} title="Branding & Social" saving={storeSaving} saved={storeSaved} onClose={() => setBrandingDialog(false)} onSave={async () => { await saveStoreSettings(); setBrandingDialog(false); }}>
            <ImageUpload label="Store Logo" value={storeLogo} onChange={setStoreLogo} aspectRatio="square" folder="general" field="store_logo" />
            {socialLinks.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/20">
                <label className="text-sm font-medium text-charcoal-light">Social Link URLs</label>
                {socialLinks.map((link, i) => {
                  const platform = getPlatform(link.platform);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full shrink-0 text-white text-[10px]" style={{ backgroundColor: platform?.color || "#666" }}>{platform?.name?.[0] || link.platform[0]?.toUpperCase()}</span>
                      <Input value={link.url} onChange={(e) => setSocialLinks((prev) => prev.map((l, idx) => idx === i ? { ...l, url: e.target.value } : l))} placeholder={platform?.placeholder || "URL"} className="text-xs h-9 flex-1" />
                      <button onClick={() => setSocialLinks((prev) => prev.filter((_, idx) => idx !== i))} className="p-1 text-charcoal-lighter/50 hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionEditDialog>

          {/* Maintenance mode modal */}
          <SectionEditDialog open={maintenanceDialog} title="Maintenance Mode" saving={storeSaving} saved={storeSaved} onClose={() => setMaintenanceDialog(false)} onSave={async () => { await saveStoreSettings(); setMaintenanceDialog(false); }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-charcoal"><FieldLabel label="Maintenance Mode" hint="Takes the storefront offline for all customers." /></p>
              <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
            </div>
          </SectionEditDialog>
        </div>
      )}

      {/* ═══ DELIVERY ═══ */}
      {activeTab === "delivery" && mounted && (
        <div className="space-y-5">
          <div className="grid lg:grid-cols-2 gap-5">
            {/* Free Delivery — read-only summary */}
            <SectionCard title="Free Delivery" onEdit={() => setFreeDeliveryDialog(true)}>
              <ToggleRow label="Free delivery" on={delivery.freeDeliveryEnabled} />
              {delivery.freeDeliveryEnabled && <Row label="Min order" value={thresholdInput ? `৳${thresholdInput}` : ""} />}
              <ToggleRow label="Also free for specific customers/products" on={standardRuleActive} />
              {standardRuleActive && <Row label="Applies to" value={`${standardApplicability}${standardSelectedIds.length ? ` · ${standardSelectedIds.length} selected` : ""}`} />}
            </SectionCard>

            {/* Express Delivery — read-only summary */}
            <SectionCard title="Express Delivery" onEdit={() => setExpressDialog(true)}>
              <ToggleRow label="Express delivery" on={delivery.expressEnabled} />
              {delivery.expressEnabled && <Row label="Charge" value={expressChargeInput ? `৳${expressChargeInput}` : ""} />}
              {delivery.expressEnabled && <Row label="Division" value={delivery.expressDivision} />}
              <ToggleRow label="Free express for specific customers/products" on={expressRuleActive} />
              {expressRuleActive && <Row label="Applies to" value={`${expressApplicability}${expressSelectedIds.length ? ` · ${expressSelectedIds.length} selected` : ""}`} />}
            </SectionCard>
          </div>

          {/* Free Delivery modal */}
          <SectionEditDialog open={freeDeliveryDialog} title="Free Delivery" saving={deliverySaving} saved={deliverySaved} onClose={() => setFreeDeliveryDialog(false)} onSave={async () => { await saveDelivery(); setFreeDeliveryDialog(false); }}>
            <div className="flex items-center gap-3"><Switch checked={delivery.freeDeliveryEnabled} onCheckedChange={delivery.setFreeDelivery} /><span className="text-sm text-charcoal-lighter">{delivery.freeDeliveryEnabled ? "Enabled" : "Disabled"}</span></div>
            {delivery.freeDeliveryEnabled && <Input label="Min Order (৳)" type="number" value={thresholdInput} onChange={(e) => setThresholdInput(e.target.value)} />}
            <Separator />
            <div className="flex items-center gap-3">
              <Switch checked={standardRuleActive} onCheckedChange={setStandardRuleActive} />
              <span className="text-sm text-charcoal-lighter">Also free for specific customers/products/etc.</span>
            </div>
            {standardRuleActive && (
              <DeliveryApplicabilityPicker
                applicability={standardApplicability}
                onApplicabilityChange={(v) => { setStandardApplicability(v); setStandardSelectedIds([]); setRuleSearchQuery(""); setRuleSearchResults([]); }}
                selectedIds={standardSelectedIds}
                onToggleSelected={(item) => setStandardSelectedIds((prev) => prev.some((s) => s.id === item.id) ? prev.filter((s) => s.id !== item.id) : [...prev, item])}
                onRemoveSelected={(id) => setStandardSelectedIds((prev) => prev.filter((s) => s.id !== id))}
                options={getDeliveryRuleOptions(standardApplicability)}
                searchQuery={ruleSearchQuery}
                onSearch={(q) => handleRuleSearch(standardApplicability, q)}
                searchResults={ruleSearchResults}
                searchLoading={ruleSearchLoading}
              />
            )}
          </SectionEditDialog>

          {/* Express Delivery modal */}
          <SectionEditDialog open={expressDialog} title="Express Delivery" saving={deliverySaving} saved={deliverySaved} onClose={() => setExpressDialog(false)} onSave={async () => { await saveDelivery(); setExpressDialog(false); }}>
            <div className="flex items-center gap-3"><Switch checked={delivery.expressEnabled} onCheckedChange={delivery.setExpressEnabled} /><span className="text-sm text-charcoal-lighter">{delivery.expressEnabled ? "Enabled" : "Disabled"}</span></div>
            {delivery.expressEnabled && (
              <>
                <Input label="Express Charge (৳)" type="number" value={expressChargeInput} onChange={(e) => setExpressChargeInput(e.target.value)} />
                <Input label={<FieldLabel label="Available Division" hint="Express delivery is only offered within this division; other areas use standard zone shipping." />} value={delivery.expressDivision} onChange={(e) => delivery.setExpressDivision(e.target.value)} placeholder="Dhaka" />
              </>
            )}
            <Separator />
            <div className="flex items-center gap-3">
              <Switch checked={expressRuleActive} onCheckedChange={setExpressRuleActive} />
              <span className="text-sm text-charcoal-lighter">Free express for specific customers/products/etc.</span>
            </div>
            {expressRuleActive && (
              <DeliveryApplicabilityPicker
                applicability={expressApplicability}
                onApplicabilityChange={(v) => { setExpressApplicability(v); setExpressSelectedIds([]); setRuleSearchQuery(""); setRuleSearchResults([]); }}
                selectedIds={expressSelectedIds}
                onToggleSelected={(item) => setExpressSelectedIds((prev) => prev.some((s) => s.id === item.id) ? prev.filter((s) => s.id !== item.id) : [...prev, item])}
                onRemoveSelected={(id) => setExpressSelectedIds((prev) => prev.filter((s) => s.id !== id))}
                options={getDeliveryRuleOptions(expressApplicability)}
                searchQuery={ruleSearchQuery}
                onSearch={(q) => handleRuleSearch(expressApplicability, q)}
                searchResults={ruleSearchResults}
                searchLoading={ruleSearchLoading}
              />
            )}
          </SectionEditDialog>

          <Card><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Delivery Zones</CardTitle><AdminButton size="xs" onClick={() => { setEditZoneId(null); setZoneName(""); setZoneAreas(""); setZoneCharge(""); setZoneDays(""); setZoneDialog(true); }}><Plus className="h-3 w-3" /> Add</AdminButton></div></CardHeader>
            <CardContent className="space-y-2">
              {delivery.zones.map((z) => (
                <div key={z.id} className="flex items-center justify-between p-3 rounded-lg bg-pearl/40">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-charcoal">{z.name}</p>
                    <p className="text-[10px] text-charcoal-lighter truncate">{z.areas}</p>
                    <p className="text-[10px] text-charcoal-lighter">{z.estimatedDays} days · {formatCurrency(z.charge)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={z.isActive} onCheckedChange={(v) => delivery.updateZone(z.id, { isActive: v })} />
                    <button
                      onClick={() => { setEditZoneId(z.id); setZoneName(z.name); setZoneAreas(z.areas); setZoneCharge(String(z.charge)); setZoneDays(z.estimatedDays); setZoneDialog(true); }}
                      className="p-1 text-charcoal-lighter hover:text-secondary transition-colors active:scale-[0.96]"
                    ><Edit className="h-3.5 w-3.5" /></button>
                    <button onClick={() => delivery.removeZone(z.id)} className="p-1 text-charcoal-lighter hover:text-destructive transition-colors active:scale-[0.96]"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
              {delivery.zones.length === 0 && <p className="text-xs text-charcoal-lighter text-center py-4">No zones</p>}
            </CardContent>
          </Card>

          <Dialog open={zoneDialog} onOpenChange={setZoneDialog}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>{editZoneId ? "Edit Delivery Zone" : "Add Delivery Zone"}</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <Input label="Zone Name" required value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder="Dhaka City" />
                <Input label="Areas" value={zoneAreas} onChange={(e) => setZoneAreas(e.target.value)} placeholder="Gulshan, Banani" />
                <div className="grid grid-cols-2 gap-3"><Input label="Charge (৳)" type="number" value={zoneCharge} onChange={(e) => setZoneCharge(e.target.value)} /><Input label="Days" value={zoneDays} onChange={(e) => setZoneDays(e.target.value)} placeholder="1-2" /></div>
              </div>
              <DialogFooter>
                <AdminButton variant="outline" size="sm" onClick={() => setZoneDialog(false)}>Cancel</AdminButton>
                <AdminButton
                  size="sm"
                  disabled={!zoneName.trim()}
                  onClick={() => {
                    if (editZoneId) {
                      delivery.updateZone(editZoneId, { name: zoneName.trim(), areas: zoneAreas.trim(), charge: Number(zoneCharge) || 0, estimatedDays: zoneDays.trim() || "3-5" });
                    } else {
                      delivery.addZone({ id: `zone-${randomId()}`, name: zoneName.trim(), areas: zoneAreas.trim(), charge: Number(zoneCharge) || 0, estimatedDays: zoneDays.trim() || "3-5", isActive: true });
                    }
                    setZoneDialog(false); setEditZoneId(null); setZoneName(""); setZoneAreas(""); setZoneCharge(""); setZoneDays("");
                  }}
                >
                  {editZoneId ? <Save className="h-3 w-3" /> : <Plus className="h-3 w-3" />} {editZoneId ? "Save" : "Add"}
                </AdminButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ═══ PAYMENT ═══ */}
      {activeTab === "payment" && (() => {
        const editingMethod = paymentMethods.find((pm) => pm.id === editPaymentId) || null;
        const patchMethod = (id: string, patch: Partial<PaymentMethod>) =>
          setPaymentMethods((p) => p.map((pm) => pm.id === id ? { ...pm, ...patch } : pm));
        return (
        <div className="space-y-5">
          <div className="flex justify-end">
            <AdminButton onClick={() => setAddPaymentDialog(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Payment Method</AdminButton>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {paymentMethods.map((m) => (
              <SectionCard key={m.id} title={m.name} icon={CreditCard} onEdit={() => setEditPaymentId(m.id)}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-charcoal-lighter">Status</span>
                  <div className="flex items-center gap-2">
                    <Switch checked={m.enabled} onCheckedChange={(v) => { patchMethod(m.id, { enabled: v }); savePayment(); }} />
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", m.enabled ? "bg-success/10 text-success" : "bg-charcoal-lighter/10 text-charcoal-lighter")}>{m.enabled ? "On" : "Off"}</span>
                  </div>
                </div>
                {m.id !== "COD" && <Row label="Account / Phone" value={m.account_number} />}
                {m.id !== "COD" && <Row label="Confirms with" value={m.input_type === "phone_number" ? "Last 4 digits" : "Transaction ID"} />}
                <div className="flex items-center gap-3 pt-1">
                  {m.icon ? <img src={m.icon} alt="" className="h-8 w-8 rounded object-contain border border-border/30" /> : <span className="text-xs text-charcoal-lighter italic">No icon</span>}
                  {m.id !== "COD" && (m.qr_image ? <span className="text-[11px] text-success">QR set</span> : <span className="text-[11px] text-charcoal-lighter">No QR</span>)}
                  <button type="button" onClick={() => { if (confirm(`Remove ${m.name}?`)) { setPaymentMethods((p) => p.filter((pm) => pm.id !== m.id)); savePayment(); } }} className="ml-auto flex items-center justify-center h-7 w-7 rounded-full text-charcoal-lighter/60 hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label={`Remove ${m.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </SectionCard>
            ))}
          </div>

          {/* Add payment method modal */}
          <SectionEditDialog open={addPaymentDialog} title="Payment Method" saving={paymentSaving} onClose={() => { setAddPaymentDialog(false); setNewPaymentName(""); }} onSave={async () => {
            const name = newPaymentName.trim();
            if (!name) return;
            setPaymentMethods((p) => [...p, { id: randomId(), name, enabled: true, account_number: "", instructions: "", qr_image: "", icon: "", input_type: "transaction_id" }]);
            setNewPaymentName("");
            await savePayment();
            setAddPaymentDialog(false);
          }}>
            <Input label="Payment method name" required value={newPaymentName} onChange={(e) => setNewPaymentName(e.target.value)} placeholder="e.g. Upay, SSLCommerz" />
            <p className="text-xs text-charcoal-lighter">You can add its account number, icon, QR and instructions after creating it (via Edit).</p>
          </SectionEditDialog>

          {/* Edit payment method modal */}
          <SectionEditDialog open={!!editingMethod} title={editingMethod?.name || "Payment Method"} saving={paymentSaving} saved={paymentSaved} onClose={() => setEditPaymentId(null)} onSave={async () => { await savePayment(); setEditPaymentId(null); }}>
            {editingMethod && (
              <>
                <Input label="Name" value={editingMethod.name} onChange={(e) => patchMethod(editingMethod.id, { name: e.target.value })} className="text-sm font-semibold" />
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-charcoal">Enabled</p>
                  <Switch checked={editingMethod.enabled} onCheckedChange={(v) => patchMethod(editingMethod.id, { enabled: v })} />
                </div>
                <ImageUpload
                  label={<FieldLabel label="Payment icon" hint="Shown in the footer's We Accept section." />}
                  value={editingMethod.icon}
                  onChange={(url) => patchMethod(editingMethod.id, { icon: url })}
                  aspectRatio="square" folder="payment-icons" field={`payment_icon_${editingMethod.id}`}
                />
                {editingMethod.id !== "COD" && (
                  <>
                    <Input label="Account / Phone" value={editingMethod.account_number} onChange={(e) => patchMethod(editingMethod.id, { account_number: e.target.value })} placeholder="01XXXXXXXXX" />
                    <div>
                      <label className="block text-sm font-medium text-charcoal-light mb-1.5">Customer confirms payment with</label>
                      <Select value={editingMethod.input_type} onValueChange={(v) => patchMethod(editingMethod.id, { input_type: v as PaymentMethod["input_type"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="transaction_id">Transaction ID</SelectItem>
                          <SelectItem value="phone_number">Last 4 digit of Phone/Account No.</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea label="Instructions" value={editingMethod.instructions} onChange={(e) => patchMethod(editingMethod.id, { instructions: e.target.value })} placeholder="How should customers pay with this method?" className="min-h-[80px]" />
                    <ImageUpload
                      label="QR Code (optional)"
                      value={editingMethod.qr_image}
                      onChange={(url) => patchMethod(editingMethod.id, { qr_image: url })}
                      aspectRatio="square" folder="payment-qr" field={`payment_qr_${editingMethod.id}`}
                    />
                  </>
                )}
              </>
            )}
          </SectionEditDialog>
        </div>
        );
      })()}

      {/* ═══ NOTIFICATIONS ═══ */}
      {activeTab === "notifications" && (() => {
        const NOTIF_SECTIONS = [
          { title: "Order Notifications" as const, items: [{ key: "order_placed", label: "Order Placed", desc: "Notify when a new order comes in" }, { key: "order_confirmed", label: "Confirmed", desc: "Notify when an admin confirms an order" }, { key: "order_shipped", label: "Shipped", desc: "Notify on shipping status updates" }, { key: "order_delivered", label: "Delivered", desc: "Notify when a delivery is completed" }, { key: "order_cancelled", label: "Cancelled", desc: "Notify on order cancellations" }] },
          { title: "Returns & Alerts" as const, items: [{ key: "return_requested", label: "Return Requested", desc: "Notify when a customer requests a return" }, { key: "return_approved", label: "Return Processed", desc: "Notify when a return is approved or rejected" }, { key: "low_stock_alert", label: "Low Stock", desc: "Notify when stock falls below the minimum" }, { key: "new_review", label: "New Review", desc: "Notify when a customer posts a review" }, { key: "new_customer", label: "New Customer", desc: "Notify on new customer registrations" }, { key: "points_earned", label: "Points Earned", desc: "Notify when a customer earns loyalty points" }, { key: "promo_offers", label: "Promotions", desc: "Marketing and promotional notifications" }] },
        ];
        const smsRecipientNames = adminPhones.filter((a) => orderSmsAdminIds.includes(a.id)).map((a) => a.name);
        return (
        <div className="space-y-5">
          {/* SMS Gateway — read-only balance check (no editable settings) */}
          <SectionCard title="SMS Gateway" description="BulkSMSBD account balance" icon={Bell} canEdit={false} onEdit={() => {}}>
            <div className="flex items-center justify-between">
              <div>
                {smsBalance !== null && !smsBalanceError ? (
                  <p className="text-2xl font-semibold text-charcoal [font-variant-numeric:tabular-nums]">{smsBalance.toLocaleString()} <span className="text-sm font-normal text-charcoal-lighter">SMS credits</span></p>
                ) : smsBalanceError ? (
                  <p className="text-sm text-destructive">{smsBalanceError}</p>
                ) : (
                  <p className="text-sm text-charcoal-lighter">{smsBalanceLoading ? "Checking balance..." : "Balance not checked yet"}</p>
                )}
              </div>
              <AdminButton variant="outline" size="sm" onClick={fetchSmsBalance} disabled={smsBalanceLoading}>
                {smsBalanceLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {smsBalanceLoading ? "Checking..." : "Check Balance"}
              </AdminButton>
            </div>
          </SectionCard>

          {/* Order SMS Recipients */}
          <SectionCard title="Order SMS Recipients" description="Admin number(s) that get an SMS on every new order." icon={Bell} onEdit={() => setOrderSmsDialog(true)}>
            <Row label="Recipients" value={smsRecipientNames.length ? smsRecipientNames.join(", ") : ""} />
          </SectionCard>

          {/* Order Email Recipients */}
          <SectionCard title="Order Email Recipients" description="Admin email(s) that get an alert on every new order." icon={Bell} onEdit={openOrderEmailDialog}>
            <Row label="Recipients" value={orderEmailAdmins.trim()} />
          </SectionCard>

          {/* Email Footer */}
          <SectionCard title="Email Footer" description="Shown at the bottom of every email, above the fixed ChineXa logo." icon={Mail} onEdit={() => setEmailFooterDialog(true)}>
            <div className="rounded-lg border border-border/40 bg-[#FDF4F8] p-3 text-xs text-[#9A8592] whitespace-pre-line leading-relaxed">
              {emailFooter.trim() || <span className="italic">No footer text set</span>}
            </div>
          </SectionCard>

          {/* Notification toggle sections */}
          <div className="grid lg:grid-cols-2 gap-5">
            {NOTIF_SECTIONS.map((s) => (
              <SectionCard key={s.title} title={s.title} icon={Bell} onEdit={() => setNotifDialog(s.title)}>
                {s.items.map((item) => <ToggleRow key={item.key} label={item.label} on={notifications[item.key] ?? true} />)}
              </SectionCard>
            ))}
          </div>

          {/* ── Modals ── */}

          {/* Order SMS recipients modal */}
          <SectionEditDialog open={orderSmsDialog} title="Order SMS Recipients" saving={orderSmsSaving} saved={orderSmsSaved} onClose={() => setOrderSmsDialog(false)} onSave={async () => { await saveOrderSmsRecipients(); setOrderSmsDialog(false); }}>
            {adminPhones.length === 0 ? (
              <p className="text-sm text-charcoal-lighter">No admin accounts have a phone number. Add a phone number to an admin under <strong>Users, Roles &amp; Access</strong> to select them here.</p>
            ) : (
              adminPhones.map((a) => (
                <label key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 cursor-pointer hover:bg-pearl/50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">{a.name}</p>
                    <p className="text-xs text-charcoal-lighter [font-variant-numeric:tabular-nums]">{a.phone}</p>
                  </div>
                  <Switch checked={orderSmsAdminIds.includes(a.id)} onCheckedChange={() => toggleOrderSmsAdmin(a.id)} />
                </label>
              ))
            )}
          </SectionEditDialog>

          {/* Order Email recipients modal (custom validation/error handling) */}
          <Dialog open={orderEmailDialog} onOpenChange={(o) => { if (!o) setOrderEmailDialog(false); }}>
            <DialogContent className="w-[95vw] max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-secondary" /> Order Email Recipients</DialogTitle>
                <DialogDescription>Admin email address(es) that receive an alert on every new order. Separate multiple with commas.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <Input label="Admin emails" value={orderEmailDraft} onChange={(e) => { setOrderEmailDraft(e.target.value); if (orderEmailError) setOrderEmailError(""); }} placeholder="ops@chinexabd.com, owner@chinexabd.com" autoFocus />
                {orderEmailError && <p className="text-xs text-destructive">{orderEmailError}</p>}
              </div>
              <DialogFooter>
                <AdminButton variant="outline" onClick={() => setOrderEmailDialog(false)} disabled={orderEmailSaving}>Cancel</AdminButton>
                <AdminButton onClick={saveOrderEmailRecipients} disabled={orderEmailSaving}>
                  {orderEmailSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving...</> : <><Save className="h-3.5 w-3.5 mr-1" /> Save</>}
                </AdminButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Email footer modal */}
          <SectionEditDialog open={emailFooterDialog} title="Email Footer" saving={emailFooterSaving} saved={emailFooterSaved} onClose={() => setEmailFooterDialog(false)} onSave={async () => { await saveEmailFooter(); setEmailFooterDialog(false); }}>
            <Textarea label="Footer text" value={emailFooter} onChange={(e) => setEmailFooter(e.target.value)} rows={4} placeholder={"ChineXa — Premium Beauty & Lifestyle\nHouse 12, Road 5, Dhaka · support@chinexabd.com · +880 1XXX-XXXXXX"} />
            <div>
              <p className="text-xs font-medium text-charcoal-lighter mb-1.5">Preview</p>
              <div className="rounded-xl border border-border/40 bg-[#FDF4F8] p-5 text-left">
                <div className="max-w-[420px]">
                  <div className="text-[#9A8592] text-xs leading-relaxed whitespace-pre-line">{emailFooter.trim() || "Your footer text will appear here."}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <div className="mt-3"><img src="/logo.png" alt="ChineXa" className="inline-block h-8 w-auto" /></div>
                </div>
              </div>
              <p className="text-[11px] text-charcoal-lighter mt-1.5">The logo is fixed and always shown beneath your text.</p>
            </div>
          </SectionEditDialog>

          {/* Notification toggles modal */}
          <SectionEditDialog open={notifDialog !== null} title={notifDialog || "Notifications"} saving={notifSaving} saved={notifSaved} onClose={() => setNotifDialog(null)} onSave={async () => { await saveNotifications(); setNotifDialog(null); }}>
            {NOTIF_SECTIONS.find((s) => s.title === notifDialog)?.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <p className="text-sm font-medium text-charcoal"><FieldLabel label={item.label} hint={item.desc} /></p>
                <Switch checked={notifications[item.key] ?? true} onCheckedChange={() => setNotifications((p) => ({ ...p, [item.key]: !p[item.key] }))} />
              </div>
            ))}
          </SectionEditDialog>
        </div>
        );
      })()}

    </div>
  );
}
