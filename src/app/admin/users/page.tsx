"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, MoreHorizontal, Shield, Key, Loader2, AlertTriangle, Lock, UserCog, ShieldCheck, Pencil } from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldLabel } from "@/components/admin/shared/field-label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getInitials, formatDateShort, cn, collectMissingFields } from "@/lib/utils";
import { ALL_PERMISSIONS } from "../layout";
import { normalizePermissions, hasFullAccess, SYSTEM_ADMIN_ROLE, type PermissionAction, type PermissionsMap } from "@/lib/admin-permissions";
import { useAdmin } from "@/contexts/admin-context";

type AdminRoleValue = "system_admin" | "superadmin" | "admin";
interface AdminUser {
  id: string; username: string; name: string; email: string; phone: string;
  role: AdminRoleValue; permissions: PermissionsMap | null; is_active: boolean;
  last_login: string | null; created_at: string;
}

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "View", add: "Add", edit: "Edit", delete: "Delete",
  handle_orders: "Handle Orders", approve: "Approve/Reject",
};

// Explains what each checkbox actually grants — shown as a "?" tooltip next
// to the action label in the permission grid, since "Edit" alone doesn't say
// whether that covers just details or also pricing/status changes.
const ACTION_HINTS: Record<PermissionAction, string> = {
  view: "See this section in the sidebar and view its list/detail pages. Without this, the section is hidden entirely.",
  add: "Create new records in this section (e.g. add a product, add a coupon).",
  edit: "Modify existing records in this section (e.g. update details, pricing, or content).",
  delete: "Permanently remove records in this section.",
  handle_orders: "Change order status (shipped, delivered, cancelled) and approve/refund returns — without granting full order editing.",
  approve: "Approve or reject submissions (e.g. customer reviews, return requests) without granting delete or full edit access.",
};

interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  permissions: PermissionsMap;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { adminId: currentAdminId, role: currentRole } = useAdmin();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<AdminUser | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<AdminUser | null>(null);
  const [accessDialog, setAccessDialog] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [editError, setEditError] = useState("");
  const [success, setSuccess] = useState("");

  // The system admin has full access too, so it sees every management control.
  const isSuperAdmin = hasFullAccess(currentRole || "");

  // Add form
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState<"admin" | "superadmin">("admin");
  const [formPerms, setFormPerms] = useState<PermissionsMap>({});

  // Edit Admin form
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState<AdminRoleValue>("admin");

  // Access edit
  const [editPerms, setEditPerms] = useState<PermissionsMap>({});

  const fetchAdmins = async () => {
    try {
      const res = await fetch("/api/admin-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list" }) });
      const data = await res.json();
      setAdmins(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/admin-roles");
      const data = await res.json();
      setRoles(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => { fetchAdmins(); fetchRoles(); }, []);

  const handleSelectRolePreset = (roleId: string) => {
    setSelectedRoleId(roleId);
    if (!roleId) return;
    const role = roles.find((r) => r.id === roleId);
    if (role) setFormPerms(normalizePermissions(role.permissions));
  };

  const handleAddAdmin = async () => {
    const missing = collectMissingFields([
      { label: "Full Name", value: formName },
      { label: "Username", value: formUsername },
      { label: "Password", value: formPassword },
    ]);
    if (missing) { setAddError(missing); return; }
    setAddError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_admin", username: formUsername.trim(), password: formPassword, name: formName.trim(), email: formEmail.trim() || null, phone: formPhone.trim() || null, role: formRole, permissions: formRole === "superadmin" ? null : formPerms }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || "Something went wrong"); return; }
      setAddDialog(false);
      setFormUsername(""); setFormPassword(""); setFormName(""); setFormEmail(""); setFormPhone(""); setFormRole("admin"); setFormPerms({}); setSelectedRoleId("");
      fetchAdmins();
      setSuccess("Admin added successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch {} finally { setSaving(false); }
  };

  const openEditDialog = (admin: AdminUser) => {
    setEditDialog(admin);
    setEditError("");
    setEditName(admin.name);
    setEditEmail(admin.email || "");
    setEditPhone(admin.phone || "");
    setEditUsername(admin.username);
    setEditRole(admin.role);
  };

  const handleSaveEdit = async () => {
    if (!editDialog) return;
    setEditError("");
    const missing = collectMissingFields([
      { label: "Full Name", value: editName },
      { label: "Username", value: editUsername },
    ]);
    if (missing) { setEditError(missing); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_admin", admin_id: editDialog.id, name: editName.trim(), email: editEmail.trim() || null, phone: editPhone.trim() || null, username: editUsername.trim(), role: editRole }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || "Something went wrong"); return; }
      setAdmins((prev) => prev.map((a) => a.id === editDialog.id ? { ...a, name: editName.trim(), email: editEmail.trim(), phone: editPhone.trim(), username: editUsername.trim(), role: editRole } : a));
      setEditDialog(null);
      setSuccess("Admin updated successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch {} finally { setSaving(false); }
  };

  const [deleteError, setDeleteError] = useState("");
  const handleDelete = async () => {
    if (!deleteDialog) return;
    setDeleteError("");
    try {
      const res = await fetch("/api/admin-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_admin", admin_id: deleteDialog.id }) });
      const data = await res.json();
      if (!res.ok) { setDeleteError(data.error || "Failed to remove admin"); return; }
      setAdmins((prev) => prev.filter((a) => a.id !== deleteDialog.id));
      setDeleteDialog(null);
    } catch { setDeleteError("Failed to remove admin"); }
  };

  const handleToggleActive = async (admin: AdminUser) => {
    const res = await fetch("/api/admin-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle_active", admin_id: admin.id, is_active: !admin.is_active }) });
    if (!res.ok) return;
    setAdmins((prev) => prev.map((a) => a.id === admin.id ? { ...a, is_active: !a.is_active } : a));
  };

  const [accessError, setAccessError] = useState("");
  const openAccessDialog = (admin: AdminUser) => {
    setAccessDialog(admin);
    setAccessError("");
    setEditPerms(normalizePermissions(admin.permissions));
  };

  const handleSaveAccess = async () => {
    if (!accessDialog) return;
    setAccessError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_permissions", admin_id: accessDialog.id, permissions: editPerms }) });
      const data = await res.json();
      if (!res.ok) { setAccessError(data.error || "Failed to save access"); return; }
      setAdmins((prev) => prev.map((a) => a.id === accessDialog.id ? { ...a, permissions: editPerms } : a));
      setAccessDialog(null);
      setSuccess("Access updated");
      setTimeout(() => setSuccess(""), 3000);
    } catch { setAccessError("Failed to save access"); } finally { setSaving(false); }
  };

  const toggleAction = (
    setPerms: React.Dispatch<React.SetStateAction<PermissionsMap>>,
    sectionKey: string,
    action: PermissionAction,
    checked: boolean
  ) => {
    setPerms((prev) => {
      const current = prev[sectionKey] || [];
      const next = checked ? [...new Set([...current, action])] : current.filter((a) => a !== action);
      return { ...prev, [sectionKey]: next };
    });
  };

  // Group permission sections by nav grouping for the checklist UI
  const permsBySection = ALL_PERMISSIONS.filter((p) => p.key !== "dashboard").reduce((acc, p) => {
    if (!acc[p.navSection]) acc[p.navSection] = [];
    acc[p.navSection].push(p);
    return acc;
  }, {} as Record<string, typeof ALL_PERMISSIONS>);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;

  const renderPermGrid = (perms: PermissionsMap, setPerms: React.Dispatch<React.SetStateAction<PermissionsMap>>) => (
    <div className="space-y-4 p-3 rounded-lg border border-border/30 bg-pearl/20">
      {Object.entries(permsBySection).map(([navSection, sections]) => (
        <div key={navSection}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal-lighter mb-1.5">{navSection}</p>
          <div className="space-y-1.5">
            {sections.map((section) => (
              <div key={section.key} className="flex items-center justify-between gap-2 flex-wrap py-0.5">
                <span className="text-sm text-charcoal">{section.label}</span>
                <div className="flex items-center gap-3">
                  {section.actions.map((action) => (
                    <label key={action} className="flex items-center gap-1.5 cursor-pointer text-xs text-charcoal-light">
                      <Checkbox
                        checked={(perms[section.key] || []).includes(action)}
                        onCheckedChange={(v) => toggleAction(setPerms, section.key, action, !!v)}
                      />
                      <FieldLabel label={ACTION_LABELS[action]} hint={ACTION_HINTS[action]} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Users, Roles & Access</h1>
          <p className="text-sm text-charcoal-lighter"><span className="font-semibold text-charcoal [font-variant-numeric:tabular-nums]">{admins.length}</span> admin{admins.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && <AdminButton variant="outline" onClick={() => router.push("/admin/roles")}><Shield className="h-4 w-4 mr-1" /> Manage Roles</AdminButton>}
          {isSuperAdmin && <AdminButton onClick={() => { setAddError(""); setAddDialog(true); }}><Plus className="h-4 w-4 mr-1" /> Add Admin</AdminButton>}
        </div>
      </div>

      {success && <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm font-medium">{success}</div>}

      {admins.length === 0 ? (
        <EmptyState icon={Shield} title="No admins" description="Add your first admin user." />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[520px] border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter">User</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter hidden sm:table-cell">Role</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter hidden md:table-cell">Access</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter hidden lg:table-cell">Last Login</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter">Status</th>
                  <th className="px-4 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => {
                  const normPerms = normalizePermissions(admin.permissions);
                  const grantedSections = Object.entries(normPerms).filter(([, actions]) => actions.length > 0);
                  return (
                  <tr key={admin.id} className={cn("border-b border-border/20 last:border-0 hover:bg-pearl/60 hover:border-secondary/15 transition-colors", admin.id === currentAdminId && "bg-primary-light/30")}>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className="text-xs">{getInitials(admin.name)}</AvatarFallback></Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-charcoal truncate">{admin.name} {admin.id === currentAdminId && <span className="text-[9px] text-secondary">(you)</span>}</p>
                          <code className="text-[10px] text-charcoal-lighter">@{admin.username}</code>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle hidden sm:table-cell">
                      <Badge variant={admin.role === SYSTEM_ADMIN_ROLE ? "gold" : admin.role === "superadmin" ? "destructive" : "secondary"} className="text-[10px]">
                        {admin.role === SYSTEM_ADMIN_ROLE ? "System Admin" : admin.role === "superadmin" ? "Super Admin" : "Admin"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-middle hidden md:table-cell">
                      {hasFullAccess(admin.role) ? (
                        <span className="text-[10px] text-charcoal-lighter">Full Access</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {grantedSections.length > 0 ? (
                            <>
                              {grantedSections.slice(0, 3).map(([key, actions]) => (
                                <span key={key} className="text-[9px] bg-pearl px-1.5 py-0.5 rounded text-charcoal-lighter capitalize">{key.replace(/_/g, " ")} ({actions.length})</span>
                              ))}
                              {grantedSections.length > 3 && <span className="text-[9px] text-charcoal-lighter">+{grantedSections.length - 3}</span>}
                            </>
                          ) : (
                            <span className="text-[10px] text-warning">No access set</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-charcoal-lighter hidden lg:table-cell">
                      {admin.last_login ? formatDateShort(admin.last_login) : "Never"}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {/* Super admins and the system admin can never be
                          deactivated (nor can you deactivate yourself) — those
                          rows show a static badge, not a toggle. Server enforces
                          this too (admin-auth route). */}
                      {isSuperAdmin && admin.id !== currentAdminId && !hasFullAccess(admin.role) ? (
                        <Switch checked={admin.is_active} onCheckedChange={() => handleToggleActive(admin)} />
                      ) : (
                        <Badge variant={admin.is_active ? "success" : "warning"} className="text-[10px]">{admin.is_active ? "Active" : "Inactive"}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {(() => {
                        // The system administrator can only be managed by
                        // itself — no actions offered to anyone else. Everyone
                        // else keeps the normal super-admin management menu.
                        const systemAdminLocked = admin.role === SYSTEM_ADMIN_ROLE && admin.id !== currentAdminId;
                        return isSuperAdmin && !systemAdminLocked && (
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1 hover:bg-pearl rounded-md transition-colors active:scale-[0.96]"><MoreHorizontal className="h-4 w-4 text-charcoal-lighter" /></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(admin)}><Pencil className="h-3.5 w-3.5 mr-2" /> Edit Admin</DropdownMenuItem>
                            {!hasFullAccess(admin.role) && admin.id !== currentAdminId && (
                              <DropdownMenuItem onClick={() => openAccessDialog(admin)}><ShieldCheck className="h-3.5 w-3.5 mr-2" /> Manage Access</DropdownMenuItem>
                            )}
                            {admin.id !== currentAdminId && !hasFullAccess(admin.role) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => { setDeleteDialog(admin); setDeleteError(""); }}><Trash2 className="h-3.5 w-3.5 mr-2" /> Remove</DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        );
                      })()}
                    </td>
                  </tr>
                  );
                })}
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
            <Input label="Full Name" required placeholder="Fahim Ahmed" value={formName} onChange={(e) => setFormName(e.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Username" required placeholder="fahim" value={formUsername} onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} />
              <Input label="Password" required placeholder="Min 6 characters" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="space-y-3">
                {roles.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-charcoal-light mb-1.5"><FieldLabel label="Preset Role (optional)" hint="Copies that role's permissions into the grid below as a starting point — you can still change anything before saving. Editing the role later won't affect this admin." /></label>
                    <Select value={selectedRoleId || "__custom"} onValueChange={(v) => handleSelectRolePreset(v === "__custom" ? "" : v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__custom">Custom (no preset)</SelectItem>
                        {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-charcoal-light mb-2"><FieldLabel label="Section Access" hint="Dashboard is always accessible. Grant View to show a section in the sidebar; grant Add/Edit/Delete to allow those specific actions." /></label>
                  {renderPermGrid(formPerms, setFormPerms)}
                </div>
              </div>
            )}
            {addError && <p className="text-xs text-destructive">{addError}</p>}
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <AdminButton variant="outline" onClick={() => setAddDialog(false)}>Cancel</AdminButton>
            <AdminButton onClick={handleAddAdmin} disabled={saving || !formUsername.trim() || !formPassword || !formName.trim()}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Add Admin
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Admin Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-secondary" /> Edit Admin</DialogTitle>
            <DialogDescription>Update {editDialog?.name}&apos;s account details</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 py-2 pr-1">
            <Input label="Full Name" required value={editName} onChange={(e) => setEditName(e.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Username" required value={editUsername} onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} />
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-1.5">Role</label>
                {/* A super admin's or system admin's role is permanent — locked
                    for the current user and any full-access target (server
                    enforces too). System admin isn't an assignable option. */}
                <Select value={editRole} onValueChange={(v) => setEditRole(v as AdminRoleValue)} disabled={editDialog?.id === currentAdminId || (!!editDialog && hasFullAccess(editDialog.role))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {editDialog?.role === SYSTEM_ADMIN_ROLE && <SelectItem value={SYSTEM_ADMIN_ROLE}>System Admin (top-most)</SelectItem>}
                    <SelectItem value="admin">Admin (restricted access)</SelectItem>
                    <SelectItem value="superadmin">Super Admin (full access)</SelectItem>
                  </SelectContent>
                </Select>
                {editDialog?.id === currentAdminId && <p className="text-[10px] text-charcoal-lighter mt-1">You can&apos;t change your own role.</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              <Input label="Phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
            {editError && <p className="text-xs text-destructive">{editError}</p>}
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <AdminButton variant="outline" onClick={() => setEditDialog(null)}>Cancel</AdminButton>
            <AdminButton onClick={handleSaveEdit} disabled={saving || !editName.trim() || !editUsername.trim()}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save Changes
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Access Dialog */}
      <Dialog open={!!accessDialog} onOpenChange={(open) => !open && setAccessDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-secondary" /> <FieldLabel label="Manage Access" hint="Dashboard is always accessible. Changes take effect on next page load." /></DialogTitle>
            <DialogDescription>Control which sections and actions {accessDialog?.name} can access</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 pr-1">
            {renderPermGrid(editPerms, setEditPerms)}
            {accessError && <p className="text-xs text-destructive mt-2">{accessError}</p>}
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <AdminButton variant="outline" onClick={() => setAccessDialog(null)}>Cancel</AdminButton>
            <AdminButton onClick={handleSaveAccess} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save Access
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Remove Admin</DialogTitle><DialogDescription>This will permanently remove this admin account.</DialogDescription></DialogHeader>
          {deleteDialog && <p className="text-sm text-charcoal-light"><strong>{deleteDialog.name}</strong> (@{deleteDialog.username})</p>}
          {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /> Remove</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
