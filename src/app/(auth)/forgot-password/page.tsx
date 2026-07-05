"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function validateBDPhone(digits: string): string | null {
  const cleaned = digits.replace(/[\s-]/g, "");
  if (cleaned.length !== 11 || !cleaned.startsWith("01") || !/^\d{11}$/.test(cleaned)) {
    return "Invalid phone number. Must be 11 digits starting with 01";
  }
  return null;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 11);
    setPhone(val);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateBDPhone(phone);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");
    const fullPhone = `+88${phone}`;

    try {
      const checkRes = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_phone", phone: fullPhone }),
      });
      const checkData = await checkRes.json();

      if (checkData.blocked) {
        setError(checkData.error || "This account has been deactivated.");
        return;
      }
      if (!checkData.found) {
        setError("No account found with this phone number.");
        return;
      }

      const otpRes = await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", phone: fullPhone, purpose: "reset" }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) throw new Error(otpData.error || "Failed to send OTP");

      sessionStorage.setItem(`otp-token:${fullPhone}:reset`, otpData.token);
      router.push(`/verify?phone=${encodeURIComponent(fullPhone)}&mode=reset`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-0 shadow-luxury-hover">
        <CardHeader className="text-center pb-2">
          <CardTitle className="font-heading text-2xl">Forgot Password</CardTitle>
          <CardDescription>Enter your phone number to receive a reset code</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Phone Number</label>
              <div className="flex">
                <div className="flex items-center gap-1.5 px-3 rounded-l-luxury border-2 border-r-0 border-border bg-pearl/60 text-sm font-semibold text-charcoal select-none">
                  <Phone className="h-3.5 w-3.5 text-charcoal-lighter" />
                  <span>+88</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="01XXXXXXXXX"
                  value={phone}
                  onChange={handlePhoneChange}
                  className={`flex-1 h-12 rounded-r-luxury border-2 px-3 text-sm text-charcoal placeholder:text-charcoal-lighter/50 outline-none transition-all ${
                    error
                      ? "border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20"
                      : "border-border focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                  }`}
                  maxLength={11}
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
            </div>

            <Button
              type="submit"
              variant="secondary"
              size="lg"
              className="w-full !text-white"
              disabled={loading || phone.length < 11}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? "Sending..." : "Send Reset Code"}
            </Button>

            <div className="text-center pt-2 border-t border-border/30">
              <p className="text-sm text-charcoal-lighter">
                Remembered your password?{" "}
                <Link href="/login" className="text-secondary hover:text-secondary-dark font-medium">
                  Sign In
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
