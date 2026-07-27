"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Phone, Loader2, MessageSquare, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

  // Which reset-OTP channels the admin has enabled AND are actually configured.
  // null = still loading. Drives: both → picker; one → auto; none → blocked.
  const [channels, setChannels] = useState<{ sms: boolean; email: boolean } | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<"sms" | "email">("sms");

  useEffect(() => {
    fetch("/api/otp/channels")
      .then((r) => (r.ok ? r.json() : { sms: false, email: false }))
      .then((d) => {
        const c = { sms: !!d.sms, email: !!d.email };
        setChannels(c);
        // Default the picker to whichever single channel is on.
        setSelectedChannel(c.sms ? "sms" : "email");
      })
      .catch(() => setChannels({ sms: false, email: false }));
  }, []);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(e.target.value.replace(/\D/g, "").slice(0, 11));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channels) return;
    const validationError = validateBDPhone(phone);
    if (validationError) { setError(validationError); return; }

    // Resolve the effective channel: the picked one when both are on, else the
    // single enabled one. Both-off is blocked before we ever get here.
    const bothOn = channels.sms && channels.email;
    const channel: "sms" | "email" = bothOn ? selectedChannel : (channels.sms ? "sms" : "email");

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
      if (checkData.blocked) { setError(checkData.error || "This account has been deactivated."); return; }
      if (!checkData.found) { setError("No account found with this phone number."); return; }

      const otpRes = await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", phone: fullPhone, purpose: "reset", channel }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) throw new Error(otpData.error || "Failed to send OTP");

      sessionStorage.setItem(`otp-token:${fullPhone}:reset`, otpData.token);
      router.push(`/verify?phone=${encodeURIComponent(fullPhone)}&mode=reset&channel=${channel}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const bothOn = channels?.sms && channels?.email;
  const noneOn = channels && !channels.sms && !channels.email;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="border-0 shadow-luxury-hover">
        <CardHeader className="text-center pb-2">
          <CardTitle className="font-heading text-2xl">Forgot Password</CardTitle>
          <CardDescription>
            {noneOn ? "Password reset is currently unavailable" : "Enter your phone number to receive a reset code"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Both OTP channels off → self-service reset is disabled (no way to
              verify ownership). Guide the customer to support instead. */}
          {noneOn ? (
            <div className="text-center space-y-4 py-4">
              <p className="text-sm text-charcoal-light leading-relaxed">
                Password reset by code isn&apos;t available right now. Please contact our support team and we&apos;ll help you regain access.
              </p>
              <Link href="/contact"><Button variant="secondary" className="w-full !text-white">Contact Support</Button></Link>
              <div className="pt-2 border-t border-border/30">
                <Link href="/login" className="text-sm text-secondary hover:text-secondary-dark font-medium">Back to Sign In</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-1.5">Phone Number<span className="text-destructive"> *</span></label>
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
                    className={cn(
                      "flex-1 h-12 rounded-r-luxury border-2 px-3 text-sm text-charcoal placeholder:text-charcoal-lighter/50 outline-none transition-all",
                      error ? "border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20" : "border-border focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                    )}
                    maxLength={11}
                    autoFocus
                  />
                </div>
                {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
              </div>

              {/* Channel picker — only when BOTH are available. With one, it's
                  auto-selected (no UI). While loading channels, show nothing. */}
              {bothOn && (
                <div>
                  <label className="block text-sm font-medium text-charcoal-light mb-1.5">Send code via</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: "sms", label: "SMS", icon: MessageSquare },
                      { id: "email", label: "Email", icon: Mail },
                    ] as const).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedChannel(opt.id)}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-luxury border py-2.5 text-sm font-medium transition-colors active:scale-[0.98]",
                          selectedChannel === opt.id ? "border-secondary bg-secondary/5 text-secondary" : "border-border text-charcoal-light hover:border-charcoal/30"
                        )}
                      >
                        <opt.icon className="h-4 w-4" /> {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                variant="secondary"
                size="lg"
                className="w-full !text-white"
                disabled={loading || phone.length < 11 || !channels}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {loading ? "Sending..." : "Send Reset Code"}
              </Button>

              <div className="text-center pt-2 border-t border-border/30">
                <p className="text-sm text-charcoal-lighter">
                  Remembered your password?{" "}
                  <Link href="/login" className="text-secondary hover:text-secondary-dark font-medium">Sign In</Link>
                </p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
