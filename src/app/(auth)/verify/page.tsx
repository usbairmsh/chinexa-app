"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth.store";

const RESEND_COOLDOWN_SECONDS = 90;

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "";
  const mode = searchParams.get("mode"); // "register" | "reset" | null (unused now — login no longer goes through OTP)
  const otpPurpose = mode === "register" ? "register" : mode === "reset" ? "reset" : "login";
  const login = useAuthStore((s) => s.login);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // "reset" mode: once OTP is verified, show a new-password form before finishing
  const [otpVerifiedForReset, setOtpVerifiedForReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all 6 digits are filled
    if (value && index === 5) {
      const code = newOtp.join("");
      if (code.length === 6) {
        setTimeout(() => autoSubmit(code), 100);
      }
    } else if (value) {
      const code = newOtp.join("");
      if (code.length === 6) {
        setTimeout(() => autoSubmit(code), 100);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    // Auto-submit if pasted 6 digits
    if (pasted.length === 6) {
      setTimeout(() => autoSubmit(pasted), 100);
    }
  };

  const autoSubmit = async (code: string) => {
    if (loading || success) return;
    if (code.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const otpToken = sessionStorage.getItem(`otp-token:${phone}:${otpPurpose}`);
      if (!otpToken) throw new Error("Verification session expired. Please request a new code.");

      const verifyRes = await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", phone, purpose: otpPurpose, code, token: otpToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "Invalid OTP");
      sessionStorage.removeItem(`otp-token:${phone}:${otpPurpose}`);

      if (mode === "reset") {
        // Don't finish yet — show the new-password form
        setOtpVerifiedForReset(true);
        return;
      }

      if (mode === "register") {
        const stored = sessionStorage.getItem(`register-data:${phone}`);
        if (!stored) throw new Error("Registration details expired. Please start over.");
        const { name, email, birthdate, password } = JSON.parse(stored);

        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "register", phone, name, email: email || undefined, birthdate, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed");
        sessionStorage.removeItem(`register-data:${phone}`);

        document.cookie = `chinexa-role=customer; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        login({
          user: { id: data.user.id, name: data.user.name, email: data.user.email, phone: data.user.phone, role: "customer" },
          token: `token-${Date.now()}`,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        setSuccess(true);
        setTimeout(() => router.push("/"), 1500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid OTP. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }
    autoSubmit(code);
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match");
      return;
    }

    setResetSaving(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", phone, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setResetSaving(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    setError("");
    try {
      const res = await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", phone, purpose: otpPurpose }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend OTP");
      sessionStorage.setItem(`otp-token:${phone}:${otpPurpose}`, data.token);
      setResendTimer(RESEND_COOLDOWN_SECONDS);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <Card className="border-0 shadow-luxury-hover">
        <CardContent className="py-16 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 15 }}
          >
            <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
          </motion.div>
          <h2 className="font-heading text-xl font-semibold text-charcoal mb-1">
            {mode === "register" ? "Welcome to ChineXa!" : mode === "reset" ? "Password Reset!" : "Welcome Back!"}
          </h2>
          <p className="text-sm text-charcoal-lighter">
            {mode === "register"
              ? "Your account has been created successfully."
              : mode === "reset"
                ? "Your password has been changed. Redirecting to sign in..."
                : "You have been successfully logged in."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (otpVerifiedForReset) {
    return (
      <Card className="border-0 shadow-luxury-hover">
        <CardHeader className="text-center pb-2">
          <CardTitle className="font-heading text-2xl">Set New Password</CardTitle>
          <CardDescription>Choose a new password for your account</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSetNewPassword} className="space-y-4">
            <Input
              label="New Password *"
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              icon={<Lock className="h-4 w-4" />}
            />
            <Input
              label="Confirm New Password *"
              type="password"
              placeholder="Re-enter your new password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              icon={<Lock className="h-4 w-4" />}
            />
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" variant="secondary" size="lg" className="w-full" isLoading={resetSaving}>
              Save New Password
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-luxury-hover">
      <CardHeader className="text-center pb-2">
        <CardTitle className="font-heading text-2xl">Verify Your Number</CardTitle>
        <CardDescription>
          Enter the 6-digit code sent to {phone || "your phone"}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* OTP Inputs */}
          <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <motion.input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`h-12 w-10 sm:h-14 sm:w-12 text-center text-lg sm:text-xl font-semibold rounded-luxury border-2 transition-all outline-none ${
                  digit
                    ? "border-secondary bg-primary-light"
                    : "border-border focus:border-secondary"
                } ${error ? "border-destructive" : ""}`}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button
            type="submit"
            variant="secondary"
            size="lg"
            className="w-full"
            isLoading={loading}
          >
            Verify & Continue
          </Button>

          <div className="text-center">
            {resendTimer > 0 ? (
              <p className="text-sm text-charcoal-lighter">
                Resend code in <span className="font-medium text-charcoal">{resendTimer}s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-secondary hover:text-secondary-dark font-medium py-2 px-3 rounded-lg disabled:opacity-50"
              >
                {resending ? "Sending..." : "Resend Code"}
              </button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Suspense fallback={<Card className="border-0 shadow-luxury-hover"><CardContent className="py-16 text-center"><p>Loading...</p></CardContent></Card>}>
        <VerifyForm />
      </Suspense>
    </motion.div>
  );
}
