/**
 * Dashboard Event System
 *
 * When an order is placed or status changes, call `triggerDashboardRefresh()`.
 * The dashboard listens for changes and auto-refreshes.
 */

const DASHBOARD_KEY = "chinexa-dashboard-updated";

export function triggerDashboardRefresh() {
  if (typeof window !== "undefined") {
    localStorage.setItem(DASHBOARD_KEY, Date.now().toString());
    // Also dispatch a custom event for same-tab listeners
    window.dispatchEvent(new CustomEvent("dashboard-refresh"));
  }
}

export function getLastDashboardUpdate(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(DASHBOARD_KEY) || "0");
}
