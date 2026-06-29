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
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          name: name.trim(),
          phone,
          email: email.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      // Set auth cookie + log the user in
      document.cookie = `chinexa-role=customer; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      login({
        user: {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
          role: "customer",
        },
        token: `token-${Date.now()}`,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      setSuccess(true);
      setTimeout(() => router.push("/"), 1500);
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
          <h2 className="font-heading text-xl font-semibold text-charcoal mb-1">Welcome to ChineXa!</h2>
          <p className="text-sm text-charcoal-lighter">Your account has been created successfully.</p>
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
            placeholder="+880 1XXXXXXXXX"
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
            Create Account
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
