"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Shield, Loader2, AlertTriangle, Crown, Lock, Cake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth.store";
import { getInitials, cn } from "@/lib/utils";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { useCustomerBadge } from "@/hooks/use-customer-badge";

const deactivationReasons = [
  "I no longer need this account",
  "I'm concerned about my privacy",
  "I found a better alternative",
  "I'm getting too many notifications",
  "Other",
];

export default function ProfilePage() {
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

  // Tier data
  const [tierName, setTierName] = useState("Bronze");
  const [tierColor, setTierColor] = useState("bg-orange-100 text-orange-700");
  // Same source as the "My Account" dashboard badge — using badge_color/name
  // directly instead of guessing a hex from the Tailwind `tier.color` class
  // keeps this badge in sync with what the dashboard page shows.
  const badgeData = useCustomerBadge();

  // Deactivation flow — 3 steps
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateStep, setDeactivateStep] = useState<1 | 2 | 3>(1);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [deactivateOtp, setDeactivateOtp] = useState("");
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateError, setDeactivateError] = useState("");
  const [deactivateOtpToken, setDeactivateOtpToken] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/customers/${user.id}/points`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.tier) {
          setTierName(data.tier.name);
          setTierColor(data.tier.color || "bg-orange-100 text-orange-700");
        }
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!user?.id || !name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || null }),
      });
      if (res.ok) {
        updateUser({ name: name.trim(), email: email.trim() || undefined });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {} finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    if (!currentPassword || !newPassword) {
      setPasswordError("Please fill in all password fields");
      return;
    }
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
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
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
              <Avatar className="h-24 w-24 ring-4 ring-primary-light shadow-lg">
                <AvatarFallback className="text-2xl font-semibold bg-secondary text-white">
                  {user?.name ? getInitials(user.name) : "G"}
                </AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left">
                <h3 className="font-heading text-lg font-semibold text-charcoal flex items-center gap-1.5">
                  {user?.name || "Guest User"}
                  {badgeData && <VerifiedBadge color={badgeData.badge_color} opacity={badgeData.badge_opacity} size={22} tooltip={badgeData.badge_name} />}
                </h3>
                <p className="text-sm text-charcoal-lighter">{user?.phone || "Not signed in"}</p>
                <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                  <Badge className={cn("text-[10px]", tierColor)}>
                    <Crown className="h-3 w-3 mr-1" /> {tierName} Member
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    <Shield className="h-3 w-3 mr-1" /> Phone Verified
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
            <Input label="Phone Number" value={user?.phone || ""} placeholder="+880 1XXXXXXXXX" disabled />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" />
            <Input
              label="Birthdate"
              value={birthdate ? new Date(birthdate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
              icon={<Cake className="h-4 w-4" />}
              disabled
            />
          </div>
          <Button variant="secondary" onClick={handleSave} disabled={saving || saved || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : saved ? <Check className="h-4 w-4 mr-1" /> : null}
            {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Password</CardTitle>
          <CardDescription>Update the password used to sign in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(""); }}
            placeholder="Enter current password"
            icon={<Lock className="h-4 w-4" />}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPasswordError(""); }}
              placeholder="At least 6 characters"
              icon={<Lock className="h-4 w-4" />}
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => { setConfirmNewPassword(e.target.value); setPasswordError(""); }}
              placeholder="Re-enter new password"
              icon={<Lock className="h-4 w-4" />}
            />
          </div>
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          <Button variant="secondary" onClick={handleChangePassword} disabled={passwordSaving || passwordSaved}>
            {passwordSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : passwordSaved ? <Check className="h-4 w-4 mr-1" /> : null}
            {passwordSaved ? "Password Updated!" : passwordSaving ? "Updating..." : "Update Password"}
          </Button>
        </CardContent>
      </Card>

      {/* Security & Account */}
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

      {/* Deactivation Dialog */}
      <Dialog open={deactivateOpen} onOpenChange={(open) => { if (!open && deactivateStep !== 3) { setDeactivateOpen(false); } }}>
        <DialogContent className="max-w-md">
          {deactivateStep === 1 && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" /> Deactivate Account
                </DialogTitle>
                <DialogDescription>
                  We&apos;re sorry to see you go. Please tell us why you&apos;re leaving so we can improve.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-xs text-amber-800 font-medium">What happens when you deactivate:</p>
                  <ul className="text-xs text-amber-700 mt-1 space-y-0.5 list-disc pl-4">
                    <li>You won&apos;t be able to log in with this phone number</li>
                    <li>Your order history will be preserved</li>
                    <li>Your loyalty points will be frozen</li>
                    <li>Contact support to reactivate your account</li>
                  </ul>
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">Reason for leaving</label>
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
            </>
          )}

          {deactivateStep === 2 && (
            <>
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
            </>
          )}

          {deactivateStep === 3 && (
            <div className="py-8 text-center">
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
