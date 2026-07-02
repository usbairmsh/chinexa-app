"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Check, Globe, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { ImageUpload } from "@/components/admin/shared/image-upload";

export default function StoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [storeLogo, setStoreLogo] = useState("");
  const [storeTagline, setStoreTagline] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [socialFacebook, setSocialFacebook] = useState("");
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialWhatsapp, setSocialWhatsapp] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementVisible, setAnnouncementVisible] = useState(true);

  useEffect(() => {
    fetch("/api/settings?keys=store_logo,store_tagline,about_text,social_links,maintenance_mode,announcement")
      .then((r) => r.json())
      .then((data) => {
        if (data.store_logo) setStoreLogo(data.store_logo);
        if (data.store_tagline) setStoreTagline(data.store_tagline);
        if (data.about_text) setAboutText(data.about_text);
        if (data.social_links) {
          setSocialFacebook(data.social_links.facebook || "");
          setSocialInstagram(data.social_links.instagram || "");
          setSocialWhatsapp(data.social_links.whatsapp || "");
          setSocialTiktok(data.social_links.tiktok || "");
        }
        if (data.maintenance_mode !== undefined) setMaintenanceMode(!!data.maintenance_mode);
        if (data.announcement) {
          setAnnouncementText(data.announcement.text || "");
          setAnnouncementVisible(data.announcement.visible !== false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings: Record<string, unknown> = {
        store_logo: storeLogo,
        store_tagline: storeTagline,
        about_text: aboutText,
        social_links: { facebook: socialFacebook, instagram: socialInstagram, whatsapp: socialWhatsapp, tiktok: socialTiktok },
        maintenance_mode: maintenanceMode,
        announcement: { text: announcementText, visible: announcementVisible },
      };
      for (const [key, value] of Object.entries(settings)) {
        await fetch("/api/settings", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
      }
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch {} finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/settings" className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-charcoal">Store Settings</h1>
            <p className="text-xs text-charcoal-lighter">Branding, social links, and store configuration</p>
          </div>
        </div>
        <AdminButton onClick={handleSave} disabled={saving} className={saved ? "!bg-success hover:!bg-success" : ""}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {saved ? "Saved!" : "Save"}
        </AdminButton>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Branding</CardTitle><CardDescription>Store logo and tagline</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <ImageUpload label="Store Logo" value={storeLogo} onChange={setStoreLogo} aspectRatio="square" folder="general" />
          <Input label="Tagline" value={storeTagline} onChange={(e) => setStoreTagline(e.target.value)} placeholder="True Beauty Knows No Borders" />
          <Textarea label="About Text" value={aboutText} onChange={(e) => setAboutText(e.target.value)} placeholder="Brief description about your store..." className="min-h-[80px]" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Social Links</CardTitle><CardDescription>Your social media profiles</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <Input label="Facebook" value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} placeholder="https://facebook.com/chinexabd" />
          <Input label="Instagram" value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} placeholder="https://instagram.com/chinexabd" />
          <Input label="WhatsApp" value={socialWhatsapp} onChange={(e) => setSocialWhatsapp(e.target.value)} placeholder="+8801700000000" />
          <Input label="TikTok" value={socialTiktok} onChange={(e) => setSocialTiktok(e.target.value)} placeholder="https://tiktok.com/@chinexabd" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Announcement Bar</CardTitle><CardDescription>Top banner message for customers</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={announcementVisible} onCheckedChange={setAnnouncementVisible} />
            <span className="text-sm text-charcoal-lighter">{announcementVisible ? "Visible" : "Hidden"}</span>
          </div>
          <Input label="Announcement Text" value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} placeholder="Free delivery on orders over ৳3,000!" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Maintenance Mode</CardTitle><CardDescription>Take your store offline temporarily</CardDescription></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-xl bg-pearl/60">
            <div>
              <p className="text-sm font-medium text-charcoal">Maintenance Mode</p>
              <p className="text-xs text-charcoal-lighter">When enabled, customers will see a maintenance page</p>
            </div>
            <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
