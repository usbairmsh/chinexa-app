"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, Shield, Loader2, AlertTriangle, Crown, Lock, Pencil, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth.store";
import { getInitials, cn, collectMissingFields } from "@/lib/utils";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { useCustomerBadge, invalidateCustomerBadge } from "@/hooks/use-customer-badge";
import { resolveTierColorStyle } from "@/lib/tier-color";
import { AvatarUpload } from "@/components/shared/avatar-upload";

const deactivationReasons = [
  "I no longer need this account",
  "I'm concerned about my privacy",
  "I found a better alternative",
  "I'm getting too many notifications",
  "Other",
];

export default function ProfilePage() {
  const shouldReduceMotion = useReducedMotion();
  const storeUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);

  // Gate persisted-store reads behind mount so server and first client render
  // match (prevents the hydration mismatch that wedges the splash loader).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const user = mounted ? storeUser : null;

  // Start empty (matches server HTML) and sync from the persisted store after
  // mount — initializing from `user` directly causes a hydration mismatch on
  // hard refresh, which wedges the initial page loader.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // View-mode by default; these open the edit modals.
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editPasswordOpen, setEditPasswordOpen] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    if (user) {
      setName((prev) => prev || user.name || "");
      setEmail((prev) => prev || user.email || "");
    }
  }, [user]);

  // Birthdate is set once at registration and never editable — fetch it
  // read-only from the customer record (not carried in the auth store).
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/customers/${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.birthdate) setBirthdate(data.birthdate);
      })
      .catch(() => {});
  }, [user?.id]);

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Same source as the "My Account" dashboard badge — one fetch instead of
  // this page separately re-fetching /points for just the tier name/color.
  const badgeData = useCustomerBadge();
  const tierColor = resolveTierColorStyle(badgeData?.tier_color);

  // Deactivation flow — 3 steps
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateStep, setDeactivateStep] = useState<1 | 2 | 3>(1);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [deactivateOtp, setDeactivateOtp] = useState("");
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateError, setDeactivateError] = useState("");
  const [deactivateOtpToken, setDeactivateOtpToken] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!user?.id || !name.trim()) return;
    setSaving(true);
    setProfileError("");
    try {
      const res = await fetch(`/api/customers/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || null }),
      });
      if (res.ok) {
        updateUser({ name: name.trim(), email: email.trim() || undefined });
        setEditProfileOpen(false);   // close modal; the view now shows the saved values
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setProfileError(data.error || "Failed to save your details");
      }
    } catch { setProfileError("Network error — please try again"); } finally { setSaving(false); }
  };

  // Reset the profile form to the current values and open the modal.
  const openEditProfile = () => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setProfileError("");
    setEditProfileOpen(true);
  };

  const [avatarError, setAvatarError] = useState("");
  const handleAvatarUploaded = async (url: string) => {
    if (!user?.id) return;
    setAvatarError("");
    try {
      const res = await fetch(`/api/customers/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: url }),
      });
      if (!res.ok) throw new Error("Failed to save profile picture");
      updateUser({ avatar: url });
      invalidateCustomerBadge(user.id);
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : "Failed to save profile picture");
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    const missing = collectMissingFields([
      { label: "Current Password", value: currentPassword },
      { label: "New Password", value: newPassword },
      { label: "Confirm New Password", value: confirmNewPassword },
    ]);
    if (missing) { setPasswordError(missing); return; }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          customer_id: user?.id,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setEditPasswordOpen(false);   // close modal on success
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const openEditPassword = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordError("");
    setEditPasswordOpen(true);
  };

  const openDeactivateFlow = () => {
    setDeactivateStep(1);
    setDeactivateReason("");
    setDeactivateOtp("");
    setDeactivateOtpToken("");
    setDeactivateError("");
    setDeactivateOpen(true);
  };

  const handleDeactivateNext = async () => {
    if (deactivateStep === 1) {
      if (!deactivateReason) { setDeactivateError("Please select a reason"); return; }
      if (!user?.phone) { setDeactivateError("Missing phone number on account"); return; }
      setDeactivateError("");
      setDeactivateLoading(true);
      try {
        const res = await fetch("/api/otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send", phone: user.phone, purpose: "deactivate" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to send verification code");
        setDeactivateOtpToken(data.token);
        setDeactivateStep(2);
      } catch (err: unknown) {
        setDeactivateError(err instanceof Error ? err.message : "Failed to send verification code");
      } finally {
        setDeactivateLoading(false);
      }
    }
  };

  const handleVerifyAndDeactivate = async () => {
    if (deactivateOtp.length !== 6) {
      setDeactivateError("Please enter the 6-digit verification code");
      return;
    }

    setDeactivateLoading(true);
    setDeactivateError("");
    try {
      const otpRes = await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", phone: user?.phone, purpose: "deactivate", code: deactivateOtp, token: deactivateOtpToken }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) throw new Error(otpData.error || "Invalid verification code");

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deactivate",
          customer_id: user?.id,
          reason: deactivateReason,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to deactivate account");
      }
      setDeactivateStep(3);
      // Auto logout after showing success
      setTimeout(() => {
        document.cookie = "chinexa-role=; path=/; max-age=0";
        logout();
        window.location.href = "/";
      }, 3000);
    } catch (err: unknown) {
      setDeactivateError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setDeactivateLoading(false); }
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold text-charcoal">My Profile</h2>

      {/* Avatar Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="shrink-0">
                <AvatarUpload
                  currentUrl={user?.avatar}
                  name={user?.name || "Profile"}
                  size={96}
                  onUploaded={handleAvatarUploaded}
                  fallback={
                    <div className="h-full w-full flex items-center justify-center text-2xl font-semibold bg-secondary text-white">
                      {user?.name ? getInitials(user.name) : "G"}
                    </div>
                  }
                />
                {avatarError && <p className="text-xs text-destructive mt-1.5 text-center">{avatarError}</p>}
              </div>
              <div className="w-full flex flex-col items-center sm:items-start text-center sm:text-left">
                <h3 className="font-heading text-lg font-semibold text-charcoal flex items-center justify-center sm:justify-start gap-1.5">
                  {user?.name || "Guest User"}
                  {badgeData?.badge_color && <VerifiedBadge color={badgeData.badge_color} opacity={badgeData.badge_opacity} size={22} tooltip={badgeData.badge_name} />}
                </h3>
                <p className="text-sm text-charcoal-lighter">{user?.phone || "Not signed in"}</p>
                <div className="flex items-center flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                  {badgeData?.tier_name && (
                    <Badge className={cn("text-[10px]", tierColor.className)} style={tierColor.style}>
                      <motion.span
                        className="inline-flex mr-1"
                        animate={shouldReduceMotion ? undefined : { y: [0, -2, 0] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <Crown className="h-3 w-3" />
                      </motion.span>
                      {badgeData.tier_name} Member
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    <Shield className="h-3 w-3 mr-1" /> Phone Verified
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Personal Info — VIEW MODE (edit via the modal below) */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Personal Information</CardTitle>
              <CardDescription>Your personal details</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={openEditProfile}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              {saved && <Check className="h-3.5 w-3.5 ml-1.5 text-success" />}
            </Button>
          </CardHeader>
          <CardContent>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-charcoal-lighter mb-0.5">Full Name</dt>
                <dd className="text-sm font-medium text-charcoal">{user?.name || "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-charcoal-lighter mb-0.5">Phone Number</dt>
                <dd className="text-sm font-medium text-charcoal">{user?.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-charcoal-lighter mb-0.5">Email</dt>
                <dd className="text-sm font-medium text-charcoal break-all">{user?.email || <span className="text-charcoal-lighter font-normal">Not added</span>}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-charcoal-lighter mb-0.5">Birthdate</dt>
                <dd className="text-sm font-medium text-charcoal">{birthdate ? new Date(birthdate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </motion.div>

      {/* Password — VIEW MODE (change via the modal below) */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Password</CardTitle>
              <CardDescription>The password used to sign in</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={openEditPassword}>
              <Lock className="h-3.5 w-3.5 mr-1" /> Change
              {passwordSaved && <Check className="h-3.5 w-3.5 ml-1.5 text-success" />}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-charcoal">
              <span className="tracking-[0.2em] text-charcoal-lighter">••••••••</span>
              {passwordSaved && <span className="text-xs text-success">Updated just now</span>}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ Edit Personal Information modal ═══ */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Personal Information</DialogTitle>
            <DialogDescription>Update your name and email. Phone &amp; birthdate can&apos;t be changed here.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <Input label="Full Name" required value={name} onChange={(e) => { setName(e.target.value); setProfileError(""); }} placeholder="Your full name" />
            <Input label="Email" value={email} onChange={(e) => { setEmail(e.target.value); setProfileError(""); }} placeholder="email@example.com" type="email" icon={<Mail className="h-4 w-4" />} />
            <Input label="Phone Number" value={user?.phone || ""} disabled icon={<Shield className="h-4 w-4" />} />
            {profileError && <p className="text-sm text-destructive">{profileError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProfileOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="secondary" className="!text-white" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Change Password modal ═══ */}
      <Dialog open={editPasswordOpen} onOpenChange={setEditPasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <Input label="Current Password" required type="password" value={currentPassword} onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(""); }} placeholder="Enter current password" icon={<Lock className="h-4 w-4" />} />
            <Input label="New Password" required type="password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setPasswordError(""); }} placeholder="At least 6 characters" icon={<Lock className="h-4 w-4" />} />
            <Input label="Confirm New Password" required type="password" value={confirmNewPassword} onChange={(e) => { setConfirmNewPassword(e.target.value); setPasswordError(""); }} placeholder="Re-enter new password" icon={<Lock className="h-4 w-4" />} />
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPasswordOpen(false)} disabled={passwordSaving}>Cancel</Button>
            <Button variant="secondary" className="!text-white" onClick={handleChangePassword} disabled={passwordSaving}>
              {passwordSaving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Updating...</> : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Security & Account */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-pearl/50">
              <div>
                <p className="text-sm font-medium text-charcoal">Phone Verification</p>
                <p className="text-xs text-charcoal-lighter">{user?.phone || "+880 17XX-XXXXXX"}</p>
              </div>
              <Badge variant="success" className="text-[10px]">Verified</Badge>
            </div>
            <Separator />
            <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/10">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">Deactivate Account</p>
                  <p className="text-xs text-charcoal-lighter mt-0.5">
                    Your account will be deactivated and you won&apos;t be able to log in. Your order history and data will be preserved.
                  </p>
                  <Button variant="ghost" size="sm" className="text-destructive text-xs mt-2 -ml-2" onClick={openDeactivateFlow}>
                    Deactivate My Account
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Deactivation Dialog */}
      <Dialog open={deactivateOpen} onOpenChange={(open) => { if (!open && deactivateStep !== 3) { setDeactivateOpen(false); } }}>
        <DialogContent className="max-w-md">
          <AnimatePresence mode="wait">
          {deactivateStep === 1 && (
            <motion.div
              key="step-1"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" /> Deactivate Account
                </DialogTitle>
                <DialogDescription>
                  We&apos;re sorry to see you go. Please tell us why you&apos;re leaving so we can improve.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="p-3 rounded-xl bg-warning/10 border border-warning/25">
                  <p className="text-xs text-warning font-medium">What happens when you deactivate:</p>
                  <ul className="text-xs text-warning mt-1 space-y-0.5 list-disc pl-4">
                    <li>You won&apos;t be able to log in with this phone number</li>
                    <li>Your order history will be preserved</li>
                    <li>Your loyalty points will be frozen</li>
                    <li>Contact support to reactivate your account</li>
                  </ul>
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">Reason for leaving<span className="text-destructive"> *</span></label>
                  <Select value={deactivateReason} onValueChange={setDeactivateReason}>
                    <SelectTrigger><SelectValue placeholder="Select a reason..." /></SelectTrigger>
                    <SelectContent>
                      {deactivationReasons.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {deactivateError && <p className="text-xs text-destructive">{deactivateError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeactivateOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeactivateNext} disabled={deactivateLoading}>
                  {deactivateLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Continue
                </Button>
              </DialogFooter>
            </motion.div>
          )}

          {deactivateStep === 2 && (
            <motion.div
              key="step-2"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <Shield className="h-5 w-5" /> Verify Your Identity
                </DialogTitle>
                <DialogDescription>
                  Enter the 6-digit code sent to {user?.phone} to confirm account deactivation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <Input
                  label="Verification Code"
                  required
                  value={deactivateOtp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setDeactivateOtp(val);
                    setDeactivateError("");
                  }}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="text-center text-lg font-mono tracking-widest"
                />
                {deactivateError && <p className="text-xs text-destructive text-center">{deactivateError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeactivateStep(1)}>Back</Button>
                <Button
                  variant="destructive"
                  onClick={handleVerifyAndDeactivate}
                  disabled={deactivateLoading || deactivateOtp.length !== 6}
                >
                  {deactivateLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Deactivate Account
                </Button>
              </DialogFooter>
            </motion.div>
          )}

          {deactivateStep === 3 && (
            <motion.div
              key="step-3"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="py-8 text-center"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 15 }}>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto mb-4">
                  <Check className="h-8 w-8 text-destructive" />
                </div>
              </motion.div>
              <h3 className="font-heading text-lg font-semibold text-charcoal mb-1">Account Deactivated</h3>
              <p className="text-sm text-charcoal-lighter">
                Your account has been deactivated. You will be logged out shortly.
              </p>
              <p className="text-xs text-charcoal-lighter mt-2">
                Contact support to reactivate your account anytime.
              </p>
            </motion.div>
          )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}
