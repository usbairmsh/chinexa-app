"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lock, User, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please enter username and password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username: username.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      // Remember Me: 30 days. Otherwise: session cookie (no max-age)
      const cookieOpts = rememberMe
        ? `path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`
        : `path=/; SameSite=Lax`;
      document.cookie = `chinexa-role=${data.user.role}; ${cookieOpts}`;
      document.cookie = `chinexa-admin-id=${data.user.id}; ${cookieOpts}`;
      document.cookie = `chinexa-admin-name=${encodeURIComponent(data.user.name)}; ${cookieOpts}`;

      router.push("/admin");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a1a1a] px-4">
      <Image src="/logo.png" alt="ChineXa" width={320} height={124} className="h-[80px] w-auto mb-8 brightness-0 invert" />

      <Card className="w-full max-w-sm border-0 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="font-heading text-xl">Admin Panel</CardTitle>
          <CardDescription>Sign in to manage your store</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-lighter" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(""); }}
                  placeholder="Enter username"
                  className="w-full h-11 pl-10 pr-3 rounded-xl border border-border text-sm text-charcoal placeholder:text-charcoal-lighter/50 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-lighter" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Enter password"
                  className="w-full h-11 pl-10 pr-10 rounded-xl border border-border text-sm text-charcoal placeholder:text-charcoal-lighter/50 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-lighter hover:text-charcoal">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox checked={rememberMe} onCheckedChange={(v) => setRememberMe(!!v)} />
              <span className="text-sm text-charcoal-lighter">Remember Me</span>
            </label>

            {error && <p className="text-xs text-destructive text-center">{error}</p>}

            <Button type="submit" variant="secondary" size="lg" className="w-full !text-white" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-xs text-white/30 mt-6">ChineXa Admin Panel · Authorized access only</p>
    </div>
  );
}
