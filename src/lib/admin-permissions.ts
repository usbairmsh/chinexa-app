export type PermissionAction = "view" | "add" | "edit" | "delete" | "handle_orders" | "approve";

export interface PermissionSectionDef {
  key: string;
  label: string;
  navSection: string;
  actions: PermissionAction[];
}

export const PERMISSION_SECTIONS: PermissionSectionDef[] = [
  { key: "products", label: "Products", navSection: "Main", actions: ["view", "add", "edit", "delete"] },
  { key: "stock", label: "Stock Management", navSection: "Main", actions: ["view", "edit"] },
  { key: "categories", label: "Categories", navSection: "Main", actions: ["view", "add", "edit", "delete"] },
  { key: "orders", label: "Order Management", navSection: "Main", actions: ["view", "edit", "handle_orders", "approve"] },
  { key: "customers", label: "Customers", navSection: "Main", actions: ["view", "add", "edit", "delete"] },
  { key: "points_deduction_rules", label: "Points Deduction Rules", navSection: "Main", actions: ["view", "add", "edit", "delete"] },
  { key: "banners", label: "Banners", navSection: "Content", actions: ["view", "add", "edit", "delete"] },
  { key: "coupons", label: "Coupons", navSection: "Content", actions: ["view", "add", "edit", "delete"] },
  { key: "offers", label: "Offers", navSection: "Content", actions: ["view", "add", "edit", "delete"] },
  { key: "reviews", label: "Reviews", navSection: "Content", actions: ["view", "approve", "delete"] },
  { key: "blog", label: "Blog", navSection: "Content", actions: ["view", "add", "edit", "delete"] },
  { key: "homepage", label: "Homepage", navSection: "Content", actions: ["view", "edit"] },
  { key: "announcements", label: "Announcements", navSection: "Content", actions: ["view", "add", "edit", "delete"] },
  { key: "policies", label: "Policy Pages", navSection: "Content", actions: ["view", "add", "edit", "delete"] },
  { key: "seo", label: "SEO", navSection: "Analytics", actions: ["view", "edit"] },
  { key: "analytics", label: "Analytics", navSection: "Analytics", actions: ["view"] },
  { key: "accounting", label: "Accounting", navSection: "Analytics", actions: ["view", "add", "edit", "delete"] },
  { key: "fraud", label: "Fraud", navSection: "Analytics", actions: ["view"] },
  { key: "activity_log", label: "Activity Log", navSection: "Analytics", actions: ["view"] },
  { key: "support_inbox", label: "Support Inbox", navSection: "Support", actions: ["view", "add", "delete"] },
  { key: "users", label: "Users, Roles & Access", navSection: "System", actions: ["view", "add", "edit", "delete"] },
  { key: "settings", label: "Settings", navSection: "System", actions: ["view", "edit"] },
];

export type PermissionsMap = Record<string, PermissionAction[]>;

export function getSectionDef(key: string): PermissionSectionDef | undefined {
  return PERMISSION_SECTIONS.find((s) => s.key === key);
}

/**
 * Normalizes whatever is stored in admin_users.permissions — the legacy flat
 * array of section keys ("can see this section") or the current per-section
 * action-map shape — into the action-map shape. Legacy entries are inferred
 * to grant view+edit only; add/delete are new, more dangerous capabilities
 * that a plain "can see this" grant should never silently imply.
 */
export function normalizePermissions(raw: unknown): PermissionsMap {
  if (!raw || typeof raw !== "object") return {};
  if (Array.isArray(raw)) {
    const map: PermissionsMap = {};
    for (const k of raw) {
      if (typeof k !== "string") continue;
      const def = getSectionDef(k);
      const allowed: PermissionAction[] = def ? def.actions.filter((a) => a === "view" || a === "edit") : ["view"];
      map[k] = allowed.length ? allowed : ["view"];
    }
    return map;
  }
  const map: PermissionsMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      map[k] = v.filter((a): a is PermissionAction =>
        a === "view" || a === "add" || a === "edit" || a === "delete" || a === "handle_orders" || a === "approve"
      );
    }
  }
  return map;
}

/** Pure predicate — role + normalized permissions map -> can admin do this? */
export function canDo(role: string, permissions: PermissionsMap, section: string, action: PermissionAction): boolean {
  if (role === "superadmin") return true;
  if (section === "dashboard") return true;
  const granted = permissions[section];
  return Array.isArray(granted) && granted.includes(action);
}
