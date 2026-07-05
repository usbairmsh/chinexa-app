"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Phone, MessageCircle, Smartphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Validate Bangladeshi phone: must be 11 digits starting with 01
function validateBDPhone(digits: string): string | null {
  const cleaned = digits.replace(/[\s-]/g, "");
  if (cleaned.length !== 11 || !cleaned.startsWith("01") || !/^\d{11}$/.test(cleaned)) {
    return "Invalid phone number. Must be 11 digits starting with 01";
  }
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"sms" | "whatsapp">("sms");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 11
    const val = e.target.value.replace(/\D/g, "").slice(0, 11);
    setPhone(val);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const validationError = validateBDPhone(phone);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    const fullPhone = `+88${phone}`;

    try {
      // Check if phone is registered BEFORE sending OTP
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", phone: fullPhone }),
      });
      const data = await res.json();

      if (data.blocked) {
        // Account is deactivated
        setError(data.error || "This account has been deactivated. Contact support to reactivate.");
      } else if (data.found) {
        // Registered — send a real OTP before going to verification
        const otpRes = await fetch("/api/otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send", phone: fullPhone, purpose: "login" }),
        });
        const otpData = await otpRes.json();
        if (!otpRes.ok) throw new Error(otpData.error || "Failed to send OTP");
        sessionStorage.setItem(`otp-token:${fullPhone}:login`, otpData.token);
        router.push(`/verify?phone=${encodeURIComponent(fullPhone)}&method=${method}&remember=${rememberMe ? "1" : "0"}`);
      } else {
        // Not registered — go to registration page with phone pre-filled
        router.push(`/register?phone=${encodeURIComponent(fullPhone)}`);
      }
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
          <CardTitle className="font-heading text-2xl">Welcome to ChineXa</CardTitle>
          <CardDescription>Enter your phone number to continue</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Phone input with +880 prefix */}
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

            <div>
              <p className="text-sm font-medium text-charcoal-light mb-3">Receive OTP via</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod("sms")}
                  className={`flex items-center justify-center gap-2 rounded-luxury border p-3 text-sm transition-all ${
                    method === "sms"
                      ? "border-secondary bg-primary-light text-charcoal font-medium"
                      : "border-border text-charcoal-lighter hover:border-secondary"
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                  SMS
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("whatsapp")}
                  className={`flex items-center justify-center gap-2 rounded-luxury border p-3 text-sm transition-all ${
                    method === "whatsapp"
                      ? "border-secondary bg-primary-light text-charcoal font-medium"
                      : "border-border text-charcoal-lighter hover:border-secondary"
                  }`}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox checked={rememberMe} onCheckedChange={(v) => setRememberMe(!!v)} />
              <span className="text-sm text-charcoal-lighter">Remember Me</span>
            </label>

            <Button
              type="submit"
              variant="secondary"
              size="lg"
              className="w-full !text-white"
              disabled={loading || phone.length < 11}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? "Checking..." : "Continue"}
            </Button>

            <div className="text-center pt-2 border-t border-border/30">
              <p className="text-sm text-charcoal-lighter">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="text-secondary hover:text-secondary-dark font-medium">
                  Register
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
