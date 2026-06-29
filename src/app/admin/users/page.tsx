"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, MoreHorizontal, Shield, Key, Loader2, AlertTriangle, Lock, UserCog, ShieldCheck } from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getInitials, formatDateShort, cn } from "@/lib/utils";
import { ALL_PERMISSIONS } from "../layout";

interface AdminUser {
  id: string; username: string; name: string; email: string; phone: string;
  role: "superadmin" | "admin"; permissions: string[] | null; is_active: boolean;
  last_login: string | null; created_at: string;
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : "";
}

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialog, setAddDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<AdminUser | null>(null);
  const [accessDialog, setAccessDialog] = useState<AdminUser | null>(null);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [profileDialog, setProfileDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const currentAdminId = getCookie("chinexa-admin-id");
  const currentRole = getCookie("chinexa-role");
  const isSuperAdmin = currentRole === "superadmin";

  // Add form
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState<"admin" | "superadmin">("admin");
  const [formPerms, setFormPerms] = useState<string[]>([]);

  // Access edit
  const [editPerms, setEditPerms] = useState<string[]>([]);

  // Password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");

  // Profile form
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");

  const fetchAdmins = async () => {
    try {
      const res = await fetch("/api/admin-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list" }) });
      const data = await res.json();
      setAdmins(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchAdmins(); }, []);

  const handleAddAdmin = async () => {
    if (!formUsername.trim() || !formPassword || !formName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_admin", requester_id: currentAdminId, username: formUsername.trim(), password: formPassword, name: formName.trim(), email: formEmail.trim() || null, phone: formPhone.trim() || null, role: formRole, permissions: formRole === "superadmin" ? null : formPerms }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setAddDialog(false);
      setFormUsername(""); setFormPassword(""); setFormName(""); setFormEmail(""); setFormPhone(""); setFormRole("admin"); setFormPerms([]);
      fetchAdmins();
      setSuccess("Admin added successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    await fetch("/api/admin-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_admin", requester_id: currentAdminId, admin_id: deleteDialog.id }) });
    setAdmins((prev) => prev.filter((a) => a.id !== deleteDialog.id));
    setDeleteDialog(null);
  };

  const handleToggleActive = async (admin: AdminUser) => {
    await fetch("/api/admin-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle_active", requester_id: currentAdminId, admin_id: admin.id, is_active: !admin.is_active }) });
    setAdmins((prev) => prev.map((a) => a.id === admin.id ? { ...a, is_active: !a.is_active } : a));
  };

  const openAccessDialog = (admin: AdminUser) => {
    setAccessDialog(admin);
    setEditPerms(Array.isArray(admin.permissions) ? [...admin.permissions] : []);
  };

  const handleSaveAccess = async () => {
    if (!accessDialog) return;
    setSaving(true);
    try {
      await fetch("/api/admin-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_permissions", requester_id: currentAdminId, admin_id: accessDialog.id, permissions: editPerms }) });
      setAdmins((prev) => prev.map((a) => a.id === accessDialog.id ? { ...a, permissions: editPerms } : a));
      setAccessDialog(null);
      setSuccess("Access updated");
      setTimeout(() => setSuccess(""), 3000);
    } catch {} finally { setSaving(false); }
  };

  const togglePerm = (perm: string, checked: boolean) => {
    setEditPerms((prev) => checked ? [...prev, perm] : prev.filter((p) => p !== perm));
  };

  const toggleFormPerm = (perm: string, checked: boolean) => {
    setFormPerms((prev) => checked ? [...prev, perm] : prev.filter((p) => p !== perm));
  };

  const handleChangePassword = async () => {
    setPwError("");
    if (!currentPw || !newPw) { setPwError("All fields are required"); return; }
    if (newPw.length < 6) { setPwError("Min 6 characters"); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "change_password", admin_id: currentAdminId, current_password: currentPw, new_password: newPw }) });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error); return; }
      setPasswordDialog(false); setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setSuccess("Password changed"); setTimeout(() => setSuccess(""), 3000);
    } catch {} finally { setSaving(false); }
  };

  const openProfile = () => {
    const me = admins.find((a) => a.id === currentAdminId);
    if (me) { setProfileName(me.name); setProfileEmail(me.email || ""); setProfilePhone(me.phone || ""); }
    setProfileDialog(true);
  };

  const handleUpdateProfile = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_profile", admin_id: currentAdminId, name: profileName.trim(), email: profileEmail.trim(), phone: profilePhone.trim() }) });
      setProfileDialog(false); fetchAdmins();
      setSuccess("Profile updated"); setTimeout(() => setSuccess(""), 3000);
    } catch {} finally { setSaving(false); }
  };

  // Group permissions by section for the checklist UI
  const permsBySection = ALL_PERMISSIONS.reduce((acc, p) => {
    if (!acc[p.section]) acc[p.section] = [];
    acc[p.section].push(p);
    return acc;
  }, {} as Record<string, typeof ALL_PERMISSIONS>);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Users, Roles & Access</h1>
          <p className="text-sm text-charcoal-lighter">{admins.length} admin{admins.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <AdminButton variant="outline" onClick={openProfile}><UserCog className="h-3.5 w-3.5" /> My Profile</AdminButton>
          <AdminButton variant="outline" onClick={() => { setPasswordDialog(true); setPwError(""); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}><Key className="h-3.5 w-3.5" /> Change Password</AdminButton>
          {isSuperAdmin && <AdminButton onClick={() => setAddDialog(true)}><Plus className="h-4 w-4 mr-1" /> Add Admin</AdminButton>}
        </div>
      </div>

      {success && <div className="p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">{success}</div>}

      {admins.length === 0 ? (
        <EmptyState icon={Shield} title="No admins" description="Add your first admin user." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 text-left">
                  <th className="px-4 py-3 font-medium text-charcoal-lighter">User</th>
                  <th className="px-4 py-3 font-medium text-charcoal-lighter hidden sm:table-cell">Role</th>
                  <th className="px-4 py-3 font-medium text-charcoal-lighter hidden md:table-cell">Access</th>
                  <th className="px-4 py-3 font-medium text-charcoal-lighter hidden lg:table-cell">Last Login</th>
                  <th className="px-4 py-3 font-medium text-charcoal-lighter">Status</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className={cn("border-b border-border/20 hover:bg-pearl/50 transition-colors", admin.id === currentAdminId && "bg-primary-light/30")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9"><AvatarFallback className="text-xs">{getInitials(admin.name)}</AvatarFallback></Avatar>
                        <div>
                          <p className="font-medium text-charcoal">{admin.name} {admin.id === currentAdminId && <span className="text-[9px] text-secondary">(you)</span>}</p>
                          <code className="text-[10px] text-charcoal-lighter">@{admin.username}</code>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant={admin.role === "superadmin" ? "destructive" : "secondary"} className="text-[10px]">
                        {admin.role === "superadmin" ? "Super Admin" : "Admin"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {admin.role === "superadmin" ? (
                        <span className="text-[10px] text-charcoal-lighter">Full Access</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {Array.isArray(admin.permissions) && admin.permissions.length > 0 ? (
                            <>
                              {admin.permissions.slice(0, 3).map((p) => (
                                <span key={p} className="text-[9px] bg-pearl px-1.5 py-0.5 rounded text-charcoal-lighter capitalize">{p.replace(/_/g, " ")}</span>
                              ))}
                              {admin.permissions.length > 3 && <span className="text-[9px] text-charcoal-lighter">+{admin.permissions.length - 3}</span>}
                            </>
                          ) : (
                            <span className="text-[10px] text-warning">No access set</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-charcoal-lighter hidden lg:table-cell">
                      {admin.last_login ? formatDateShort(admin.last_login) : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      {isSuperAdmin && admin.id !== currentAdminId ? (
                        <Switch checked={admin.is_active} onCheckedChange={() => handleToggleActive(admin)} />
                      ) : (
                        <Badge variant={admin.is_active ? "success" : "warning"} className="text-[10px]">{admin.is_active ? "Active" : "Inactive"}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isSuperAdmin && admin.id !== currentAdminId && (
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1 hover:bg-pearl rounded-md"><MoreHorizontal className="h-4 w-4 text-charcoal-lighter" /></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {admin.role !== "superadmin" && (
                              <DropdownMenuItem onClick={() => openAccessDialog(admin)}><ShieldCheck className="h-3.5 w-3.5 mr-2" /> Manage Access</DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(admin)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Remove</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Add Admin Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Add Admin User</DialogTitle>
            <DialogDescription>Create a new admin account with specific access</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 py-2 pr-1">
            <Input label="Full Name *" placeholder="Fahim Ahmed" value={formName} onChange={(e) => setFormName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Username *" placeholder="fahim" value={formUsername} onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} />
              <Input label="Password *" placeholder="Min 6 characters" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Email" placeholder="fahim@chinexa.com" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
              <Input label="Phone" placeholder="+880170000000" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Role</label>
              <Select value={formRole} onValueChange={(v) => setFormRole(v as "admin" | "superadmin")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (restricted access)</SelectItem>
                  <SelectItem value="superadmin">Super Admin (full access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formRole === "admin" && (
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-2">Section Access</label>
                <div className="space-y-3 p-3 rounded-xl border border-border/30 bg-pearl/20">
                  {Object.entries(permsBySection).map(([section, perms]) => (
                    <div key={section}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal-lighter mb-1.5">{section}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {perms.filter((p) => p.key !== "dashboard").map((p) => (
                          <label key={p.key} className="flex items-center gap-2 cursor-pointer text-sm text-charcoal">
                            <Checkbox checked={formPerms.includes(p.key)} onCheckedChange={(v) => toggleFormPerm(p.key, !!v)} />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-charcoal-lighter mt-1.5">Dashboard is always accessible. Unchecked sections will be hidden from sidebar.</p>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <AdminButton variant="outline" onClick={() => setAddDialog(false)}>Cancel</AdminButton>
            <AdminButton onClick={handleAddAdmin} disabled={saving || !formUsername.trim() || !formPassword || !formName.trim()}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Add Admin
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Access Dialog */}
      <Dialog open={!!accessDialog} onOpenChange={(open) => !open && setAccessDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-secondary" /> Manage Access</DialogTitle>
            <DialogDescription>Control which sections {accessDialog?.name} can access</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 pr-1">
            <div className="space-y-4 p-3 rounded-xl border border-border/30 bg-pearl/20">
              {Object.entries(permsBySection).map(([section, perms]) => (
                <div key={section}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal-lighter">{section}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const sectionKeys = perms.filter((p) => p.key !== "dashboard").map((p) => p.key);
                        const allChecked = sectionKeys.every((k) => editPerms.includes(k));
                        if (allChecked) {
                          setEditPerms((prev) => prev.filter((p) => !sectionKeys.includes(p)));
                        } else {
                          setEditPerms((prev) => [...new Set([...prev, ...sectionKeys])]);
                        }
                      }}
                      className="text-[9px] text-secondary hover:text-secondary-dark font-medium"
                    >
                      Toggle all
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {perms.filter((p) => p.key !== "dashboard").map((p) => (
                      <label key={p.key} className="flex items-center gap-2 cursor-pointer text-sm text-charcoal">
                        <Checkbox checked={editPerms.includes(p.key)} onCheckedChange={(v) => togglePerm(p.key, !!v)} />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-charcoal-lighter mt-2">Dashboard is always accessible. Changes take effect on next page load.</p>
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <AdminButton variant="outline" onClick={() => setAccessDialog(null)}>Cancel</AdminButton>
            <AdminButton onClick={handleSaveAccess} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save Access
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password */}
      <Dialog open={passwordDialog} onOpenChange={(open) => { if (!open) { setPasswordDialog(false); setPwError(""); } }}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-secondary" /> Change Password</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input label="Current Password" type="password" value={currentPw} onChange={(e) => { setCurrentPw(e.target.value); setPwError(""); }} />
            <Input label="New Password" type="password" placeholder="Min 6 characters" value={newPw} onChange={(e) => { setNewPw(e.target.value); setPwError(""); }} />
            <Input label="Confirm" type="password" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setPwError(""); }} />
            {pwError && <p className="text-xs text-destructive">{pwError}</p>}
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setPasswordDialog(false)}>Cancel</AdminButton>
            <AdminButton onClick={handleChangePassword} disabled={saving}>{saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Update</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile */}
      <Dialog open={profileDialog} onOpenChange={setProfileDialog}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader><DialogTitle>My Profile</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input label="Display Name" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            <Input label="Email" type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} />
            <Input label="Phone" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} />
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setProfileDialog(false)}>Cancel</AdminButton>
            <AdminButton onClick={handleUpdateProfile} disabled={saving}>{saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Remove Admin</DialogTitle><DialogDescription>This will permanently remove this admin account.</DialogDescription></DialogHeader>
          {deleteDialog && <p className="text-sm text-charcoal-light"><strong>{deleteDialog.name}</strong> (@{deleteDialog.username})</p>}
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /> Remove</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
