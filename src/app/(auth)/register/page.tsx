"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { User, Phone, Mail, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth.store";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneParam = searchParams.get("phone") || "";
  const login = useAuthStore((s) => s.login);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState(phoneParam);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!phone) {
      setError("Phone number is missing. Please go back and enter your phone number.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // First check if phone is already registered
      const checkRes = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", phone }),
      });
      const checkData = await checkRes.json();

      if (checkData.blocked) {
        setError(checkData.error || "This phone number belongs to a deactivated account.");
        return;
      }

      if (checkData.found && checkData.user) {
        // Already registered — log them in directly
        document.cookie = `chinexa-role=customer; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        login({
          user: checkData.user,
          token: `token-${Date.now()}`,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        setSuccess(true);
        setTimeout(() => router.push("/"), 1500);
        return;
      }

      // Not registered — send a real OTP, then go to verification with registration data
      const otpRes = await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", phone, purpose: "register" }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) throw new Error(otpData.error || "Failed to send OTP");
      sessionStorage.setItem(`otp-token:${phone}:register`, otpData.token);

      router.push(
        `/verify?phone=${encodeURIComponent(phone)}&mode=register&name=${encodeURIComponent(name.trim())}&email=${encodeURIComponent(email.trim())}`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
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
          <h2 className="font-heading text-xl font-semibold text-charcoal mb-1">Welcome Back!</h2>
          <p className="text-sm text-charcoal-lighter">You already have an account. Logging you in...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-luxury-hover">
      <CardHeader className="text-center pb-2">
        <CardTitle className="font-heading text-2xl">Create Your Account</CardTitle>
        <CardDescription>Just a few details to get started</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name *"
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={<User className="h-4 w-4" />}
          />

          <Input
            label="Phone Number *"
            type="tel"
            placeholder="+88 01XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            icon={<Phone className="h-4 w-4" />}
          />

          <Input
            label="Email (optional)"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="h-4 w-4" />}
          />

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
            Verify & Create Account
          </Button>

          <p className="text-xs text-center text-charcoal-lighter">
            Already have an account?{" "}
            <Link href="/login" className="text-secondary hover:text-secondary-dark font-medium">
              Sign In
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Suspense fallback={<Card className="border-0 shadow-luxury-hover"><CardContent className="py-16 text-center"><p>Loading...</p></CardContent></Card>}>
        <RegisterForm />
      </Suspense>
    </motion.div>
  );
}
