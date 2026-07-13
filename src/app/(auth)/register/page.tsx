"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { User, Phone, Mail, Cake, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneParam = searchParams.get("phone") || "";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState(phoneParam);
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name"); return; }
    if (!phone) { setError("Phone number is missing. Please go back and enter your phone number."); return; }
    if (!birthdate) { setError("Please enter your birthdate"); return; }
    if (!password || password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }

    setLoading(true);
    setError("");

    try {
      // Make sure this phone isn't already registered before sending an OTP
      const checkRes = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_phone", phone }),
      });
      const checkData = await checkRes.json();

      if (checkData.blocked) {
        setError(checkData.error || "This phone number belongs to a deactivated account.");
        return;
      }
      if (checkData.found) {
        setError("This phone number is already registered. Please log in instead.");
        return;
      }

      // Send OTP, then hand off to /verify to confirm the phone before creating the account
      const otpRes = await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", phone, purpose: "register" }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) throw new Error(otpData.error || "Failed to send OTP");

      sessionStorage.setItem(`otp-token:${phone}:register`, otpData.token);
      sessionStorage.setItem(`register-data:${phone}`, JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        birthdate,
        password,
      }));

      router.push(`/verify?phone=${encodeURIComponent(phone)}&mode=register`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-luxury-hover">
      <CardHeader className="text-center pb-2">
        <CardTitle className="font-heading text-2xl">Create Your Account</CardTitle>
        <CardDescription>Just a few details to get started</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            required
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={<User className="h-4 w-4" />}
          />

          <Input
            label="Phone Number"
            required
            type="tel"
            placeholder="+88 01XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            icon={<Phone className="h-4 w-4" />}
          />

          <Input
            label="Birthdate"
            required
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            icon={<Cake className="h-4 w-4" />}
          />

          <Input
            label="Email (optional)"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="h-4 w-4" />}
          />

          <Input
            label="Password"
            required
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="h-4 w-4" />}
          />

          <Input
            label="Confirm Password"
            required
            type="password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            icon={<Lock className="h-4 w-4" />}
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
            Continue
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
