"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, MoreHorizontal, Shield, Loader2, AlertTriangle, Pencil } from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldLabel } from "@/components/admin/shared/field-label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn, collectMissingFields } from "@/lib/utils";
import { ALL_PERMISSIONS } from "../layout";
import { normalizePermissions, type PermissionAction, type PermissionsMap } from "@/lib/admin-permissions";

interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  permissions: PermissionsMap;
  created_at: string;
}

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "View", add: "Add", edit: "Edit", delete: "Delete",
  handle_orders: "Handle Orders", approve: "Approve/Reject",
};

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : "";
}

export default function AdminRolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [dialog, setDialog] = useState<"add" | AdminRole | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<AdminRole | null>(null);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPerms, setFormPerms] = useState<PermissionsMap>({});

  const currentRole = getCookie("chinexa-role");
  const isSuperAdmin = currentRole === "superadmin";

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/admin-roles");
      const data = await res.json();
      setRoles(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchRoles(); }, []);

  const openAdd = () => {
    setFormName(""); setFormDescription(""); setFormPerms({}); setError("");
    setDialog("add");
  };

  const openEdit = (role: AdminRole) => {
    setFormName(role.name); setFormDescription(role.description || ""); setFormPerms(normalizePermissions(role.permissions)); setError("");
    setDialog(role);
  };

  const toggleAction = (sectionKey: string, action: PermissionAction, checked: boolean) => {
    setFormPerms((prev) => {
      const current = prev[sectionKey] || [];
      const next = checked ? [...new Set([...current, action])] : current.filter((a) => a !== action);
      return { ...prev, [sectionKey]: next };
    });
  };

  const handleSave = async () => {
    const missing = collectMissingFields([{ label: "Role Name", value: formName }]);
    if (missing) { setError(missing); return; }
    setSaving(true);
    setError("");
    try {
      const isEdit = dialog !== "add" && dialog !== null;
      const res = await fetch(isEdit ? `/api/admin-roles/${dialog.id}` : "/api/admin-roles", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim(), description: formDescription.trim() || null, permissions: formPerms }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      setDialog(null);
      fetchRoles();
      setSuccess(isEdit ? "Role updated" : "Role created");
      setTimeout(() => setSuccess(""), 3000);
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    await fetch(`/api/admin-roles/${deleteDialog.id}`, { method: "DELETE" });
    setRoles((prev) => prev.filter((r) => r.id !== deleteDialog.id));
    setDeleteDialog(null);
  };

  const permsBySection = ALL_PERMISSIONS.filter((p) => p.key !== "dashboard").reduce((acc, p) => {
    if (!acc[p.navSection]) acc[p.navSection] = [];
    acc[p.navSection].push(p);
    return acc;
  }, {} as Record<string, typeof ALL_PERMISSIONS>);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;

  if (!isSuperAdmin) {
    return <EmptyState icon={Shield} title="Not permitted" description="Only a super admin can manage roles." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin/users")} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-charcoal-lighter hover:text-charcoal hover:border-charcoal transition-all">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-charcoal">Roles</h1>
            <p className="text-sm text-charcoal-lighter">Reusable permission presets — pick one when adding a new admin.</p>
          </div>
        </div>
        <AdminButton onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Role</AdminButton>
      </div>

      {success && <div className="p-3 rounded-luxury bg-success/10 border border-success/20 text-success text-sm font-medium">{success}</div>}

      {roles.length === 0 ? (
        <EmptyState icon={Shield} title="No roles yet" description="Create a role to use as a preset when adding admins." actionLabel="Add Role" onAction={openAdd} />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-border/30 text-left">
                  <th className="px-4 py-3 font-medium text-charcoal-lighter">Role</th>
                  <th className="px-4 py-3 font-medium text-charcoal-lighter hidden md:table-cell">Access</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const normPerms = normalizePermissions(role.permissions);
                  const grantedSections = Object.entries(normPerms).filter(([, actions]) => actions.length > 0);
                  return (
                    <tr key={role.id} className="border-b border-border/20 hover:bg-pearl/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-charcoal">{role.name}</p>
                        {role.description && <p className="text-[11px] text-charcoal-lighter">{role.description}</p>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap items-center gap-1 max-w-[280px]">
                          {grantedSections.length > 0 ? (
                            <>
                              {grantedSections.slice(0, 3).map(([key, actions]) => (
                                <Badge key={key} variant="outline" className="text-[10px] py-0 capitalize">{key.replace(/_/g, " ")} ({actions.length})</Badge>
                              ))}
                              {grantedSections.length > 3 && <span className="text-[10px] text-charcoal-lighter">+{grantedSections.length - 3}</span>}
                            </>
                          ) : (
                            <Badge variant="warning" className="text-[10px] py-0">No access set</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1 hover:bg-pearl rounded-md"><MoreHorizontal className="h-4 w-4 text-charcoal-lighter" /></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(role)}><Pencil className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog(role)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Role Dialog */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{dialog === "add" ? "Add Role" : "Edit Role"}</DialogTitle>
            <DialogDescription>A named permission preset you can select when adding a new admin.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 py-2 pr-1">
            <Input label="Role Name" required placeholder="Support Staff" value={formName} onChange={(e) => setFormName(e.target.value)} />
            <Textarea label="Description" placeholder="What this role is for" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-2"><FieldLabel label="Section Access" hint="This is copied into an admin's own permissions when this role is selected as a preset — editing the role later does not affect admins who already picked it." /></label>
              <div className="space-y-4 p-3 rounded-luxury border border-border/30 bg-pearl/20">
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
                                  checked={(formPerms[section.key] || []).includes(action)}
                                  onCheckedChange={(v) => toggleAction(section.key, action, !!v)}
                                />
                                {ACTION_LABELS[action]}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <AdminButton variant="outline" onClick={() => setDialog(null)}>Cancel</AdminButton>
            <AdminButton onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} {dialog === "add" ? "Create Role" : "Save Changes"}
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete Role</DialogTitle><DialogDescription>Admins who already used this role as a preset keep their current permissions — this only removes the preset itself.</DialogDescription></DialogHeader>
          {deleteDialog && <p className="text-sm text-charcoal-light"><strong>{deleteDialog.name}</strong></p>}
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /> Delete</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
