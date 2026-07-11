"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Phone, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth.store";
import { authCookieOpts } from "@/lib/auth-cookie";

// Validate Bangladeshi phone: must be 11 digits starting with 01
function validateBDPhone(digits: string): string | null {
  const cleaned = digits.replace(/[\s-]/g, "");
  if (cleaned.length !== 11 || !cleaned.startsWith("01") || !/^\d{11}$/.test(cleaned)) {
    return "Invalid phone number. Must be 11 digits starting with 01";
  }
  return null;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
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

    const validationError = validateBDPhone(phone);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!password) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);
    setError("");

    const fullPhone = `+88${phone}`;

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", phone: fullPhone, password }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Invalid phone number or password");
        return;
      }

      document.cookie = `chinexa-role=customer; ${authCookieOpts(rememberMe)}`;
      login({
        user: data.user,
        token: `token-${Date.now()}`,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const redirect = searchParams.get("redirect");
      router.push(redirect && redirect.startsWith("/") ? redirect : "/");
    } catch {
      setError("Something went wrong. Please try again.");
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
          <CardDescription>Sign in with your phone number and password</CardDescription>
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
            </div>

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              icon={<Lock className="h-4 w-4" />}
            />

            {error && <p className="text-xs text-destructive -mt-2">{error}</p>}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox checked={rememberMe} onCheckedChange={(v) => setRememberMe(!!v)} />
                <span className="text-sm text-charcoal-lighter">Remember Me</span>
              </label>
              <Link href="/forgot-password" className="text-sm text-secondary hover:text-secondary-dark font-medium">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="secondary"
              size="lg"
              className="w-full !text-white"
              disabled={loading || phone.length < 11 || !password}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? "Signing in..." : "Sign In"}
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

export default function LoginPage() {
  return (
    <Suspense fallback={<Card className="border-0 shadow-luxury-hover"><CardContent className="py-16 text-center"><p>Loading...</p></CardContent></Card>}>
      <LoginForm />
    </Suspense>
  );
}
