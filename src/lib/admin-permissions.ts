export type PermissionAction = "view" | "add" | "edit" | "delete" | "handle_orders" | "approve" | "draft" | "broadcast" | "manage_mailboxes";

// The single, top-most owner role. Sits above superadmin: has full access to
// everything, cannot be created/edited/deleted/deactivated/demoted by anyone
// (not even a superadmin), and can only be managed by itself. Enforced
// server-side in /api/admin-auth. There is exactly one, pinned in the DB.
export const SYSTEM_ADMIN_ROLE = "system_admin";

/** True for the top-most owner OR a superadmin — both get unrestricted access. */
export function hasFullAccess(role: string): boolean {
  return role === SYSTEM_ADMIN_ROLE || role === "superadmin";
}

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
  { key: "brands", label: "Brands", navSection: "Main", actions: ["view", "add", "edit", "delete"] },
  { key: "orders", label: "Order Management", navSection: "Main", actions: ["view", "edit", "handle_orders", "approve"] },
  { key: "returns", label: "Returns & Refunds", navSection: "Main", actions: ["view", "approve"] },
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
  // email_inbox: view = read scoped mailboxes/threads, add = send (reply/compose/
  // forward), broadcast = send segment broadcasts, draft = save/send drafts,
  // delete = remove threads/messages, manage_mailboxes = create/edit/delete
  // mailboxes. WHICH mailboxes an admin may touch is a separate per-admin scope
  // (permissions.__mailboxes — see getMailboxScope), enforced on every route.
  { key: "email_inbox", label: "Email Center", navSection: "Support", actions: ["view", "add", "draft", "broadcast", "delete", "manage_mailboxes"] },
  { key: "users", label: "Users, Roles & Access", navSection: "System", actions: ["view", "add", "edit", "delete"] },
  { key: "settings", label: "Settings", navSection: "System", actions: ["view", "edit"] },
];

export type PermissionsMap = Record<string, PermissionAction[]>;

// Reserved key in a PermissionsMap holding the per-admin list of mailbox ids the
// admin may access in the Email Center. NOT a section — stored alongside the
// action map in the same JSON so no schema change is needed. Absent/empty for a
// non-full-access admin means "no mailbox access".
export const MAILBOX_SCOPE_KEY = "__mailboxes";

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
    // Preserve the reserved mailbox-scope list verbatim (array of mailbox ids),
    // not through the action filter below.
    if (k === MAILBOX_SCOPE_KEY) {
      if (Array.isArray(v)) {
        (map as Record<string, unknown>)[k] = v.filter((x): x is string => typeof x === "string");
      }
      continue;
    }
    if (Array.isArray(v)) {
      map[k] = v.filter((a): a is PermissionAction =>
        a === "view" || a === "add" || a === "edit" || a === "delete" || a === "handle_orders" || a === "approve" || a === "draft" || a === "broadcast" || a === "manage_mailboxes"
      );
    }
  }
  return map;
}

/** True when the mailbox-scope key has never been set on this admin (legacy /
 *  pre-feature). Distinct from "set but empty" (explicitly no mailboxes). */
export function mailboxScopeUnset(permissions: PermissionsMap): boolean {
  return !((MAILBOX_SCOPE_KEY as string) in (permissions as Record<string, unknown>));
}

/** The mailbox ids a non-full-access admin is explicitly scoped to (empty array
 *  when the key is set-but-empty OR unset — use mailboxScopeUnset to tell the
 *  legacy "all" case apart). */
export function getMailboxScope(permissions: PermissionsMap): string[] {
  const raw = (permissions as Record<string, unknown>)[MAILBOX_SCOPE_KEY];
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Can this admin access (view/use) the given mailbox?
 * - Full-access roles: always.
 * - Legacy admins whose scope was never set (mailboxScopeUnset): all mailboxes,
 *   so nobody who could use email before this feature is locked out on deploy.
 *   Once a superadmin sets any explicit scope, only those mailboxes apply.
 */
export function canAccessMailbox(role: string, permissions: PermissionsMap, mailboxId: string): boolean {
  if (hasFullAccess(role)) return true;
  if (mailboxScopeUnset(permissions)) return true; // grandfathered until narrowed
  return getMailboxScope(permissions).includes(mailboxId);
}

/** Pure predicate — role + normalized permissions map -> can admin do this? */
export function canDo(role: string, permissions: PermissionsMap, section: string, action: PermissionAction): boolean {
  if (hasFullAccess(role)) return true;
  if (section === "dashboard") return true;
  const granted = permissions[section];
  return Array.isArray(granted) && granted.includes(action);
}
