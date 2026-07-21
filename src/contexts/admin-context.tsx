"use client";

import { createContext, useContext } from "react";
import type { PermissionsMap, PermissionAction } from "@/lib/admin-permissions";

export interface AdminContextValue {
  adminId: string;
  role: string;
  /** True when `role` is system-admin-effective via a delegation (not the real owner). */
  isDelegate: boolean;
  permissions: PermissionsMap;
  name: string;
  email: string;
  phone: string;
  username: string;
  can: (section: string, action: PermissionAction) => boolean;
}

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin() must be used within AdminLayout");
  return ctx;
}
