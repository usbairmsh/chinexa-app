"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Camera, Check, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth.store";
import { getInitials } from "@/lib/utils";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold text-charcoal">My Profile</h2>

      {/* Avatar Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="relative">
                <Avatar className="h-24 w-24 ring-4 ring-primary-light shadow-lg">
                  <AvatarFallback className="text-2xl font-semibold bg-secondary text-white">
                    {user?.name ? getInitials(user.name) : "G"}
                  </AvatarFallback>
                </Avatar>
                <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-card border border-border/30 text-charcoal-lighter hover:text-secondary transition-colors">
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <div className="text-center sm:text-left">
                <h3 className="font-heading text-lg font-semibold text-charcoal">{user?.name || "Guest User"}</h3>
                <p className="text-sm text-charcoal-lighter">{user?.phone || "Not signed in"}</p>
                <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                  <Badge variant="secondary" className="text-[10px]">Gold Member</Badge>
                  <Badge variant="outline" className="text-[10px]">
                    <Shield className="h-3 w-3 mr-1" /> Verified
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
            <Input label="Full Name" defaultValue={user?.name || ""} placeholder="Your full name" />
            <Input label="Phone Number" defaultValue={user?.phone || ""} placeholder="+880 1XXXXXXXXX" disabled />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Email" defaultValue={user?.email || ""} placeholder="email@example.com" type="email" />
            <Input label="Date of Birth" type="date" />
          </div>
          <Button variant="secondary" onClick={handleSave} disabled={saved}>
            {saved ? <><Check className="h-4 w-4 mr-1" /> Saved!</> : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
          <CardDescription>Manage your communication preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Order Updates via SMS", desc: "Receive order status updates on your phone", enabled: true },
            { label: "Promotional Messages", desc: "Get exclusive deals and new arrival alerts", enabled: true },
            { label: "WhatsApp Notifications", desc: "Receive updates via WhatsApp", enabled: false },
            { label: "Email Newsletter", desc: "Weekly beauty tips and offers", enabled: true },
          ].map((pref) => (
            <div key={pref.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-charcoal">{pref.label}</p>
                <p className="text-xs text-charcoal-lighter">{pref.desc}</p>
              </div>
              <Switch defaultChecked={pref.enabled} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-pearl/50">
            <div>
              <p className="text-sm font-medium text-charcoal">Phone Verification</p>
              <p className="text-xs text-charcoal-lighter">{user?.phone || "+880 17XX-XXXXXX"}</p>
            </div>
            <Badge variant="success" className="text-[10px]">Verified</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-pearl/50">
            <div>
              <p className="text-sm font-medium text-charcoal">Two-Factor Authentication</p>
              <p className="text-xs text-charcoal-lighter">Extra security for your account</p>
            </div>
            <Switch />
          </div>
          <Separator />
          <Button variant="ghost" className="text-destructive text-sm">Delete My Account</Button>
        </CardContent>
      </Card>
    </div>
  );
}
