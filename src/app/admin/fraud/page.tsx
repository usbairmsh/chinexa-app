"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Shield, ShieldCheck, ShieldX, Eye, Ban, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatCurrency } from "@/lib/utils";

interface FraudAlert {
  id: string;
  order_id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  amount: number;
  risk_score: number;
  risk_factors: string[];
  status: "flagged" | "reviewed" | "cleared" | "blocked";
  reviewed_by: string | null;
  notes: string | null;
  created_at: string;
}

interface FraudStats {
  flagged: number;
  reviewed: number;
  cleared: number;
  blocked: number;
  total: number;
}

const statusConfig = {
  flagged: { label: "Flagged", variant: "warning" as const, icon: AlertTriangle },
  reviewed: { label: "Under Review", variant: "secondary" as const, icon: Eye },
  cleared: { label: "Cleared", variant: "success" as const, icon: ShieldCheck },
  blocked: { label: "Blocked", variant: "destructive" as const, icon: ShieldX },
};

const getRiskColor = (score: number) => {
  if (score >= 80) return "text-destructive";
  if (score >= 50) return "text-warning";
  return "text-success";
};

const getRiskBarColor = (score: number) => {
  if (score >= 80) return "bg-destructive";
  if (score >= 50) return "bg-warning";
  return "bg-success";
};

export default function AdminFraudPage() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [stats, setStats] = useState<FraudStats>({ flagged: 0, reviewed: 0, cleared: 0, blocked: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const fetchFraud = async () => {
    try {
      const res = await fetch("/api/fraud");
      const data = await res.json();
      const rows = (Array.isArray(data.data) ? data.data : []).map((r: Record<string, unknown>) => {
        // Per-row parse guard: one malformed row must not wipe the whole list
        let riskFactors: unknown = r.risk_factors || [];
        if (typeof r.risk_factors === "string") {
          try { riskFactors = JSON.parse(r.risk_factors); } catch { riskFactors = []; }
        }
        return {
          ...r,
          amount: Number(r.amount) || 0,
          risk_score: Number(r.risk_score) || 0,
          risk_factors: Array.isArray(riskFactors) ? riskFactors : [],
        };
      });
      setAlerts(rows);
      setStats(data.stats || { flagged: 0, reviewed: 0, cleared: 0, blocked: 0, total: 0 });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFraud(); }, []);

  const handleStatusUpdate = async (alertId: string, newStatus: "cleared" | "blocked" | "reviewed") => {
    await fetch("/api/fraud", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: alertId, status: newStatus }),
    }).catch(() => {});
    setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, status: newStatus } : a));
    setStats((prev) => {
      const updated = { ...prev };
      const old = alerts.find((a) => a.id === alertId);
      if (old) {
        updated[old.status] = Math.max(0, updated[old.status] - 1);
        updated[newStatus] = (updated[newStatus] || 0) + 1;
      }
      return updated;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 text-secondary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-charcoal">Fraud Detection</h1>
        <p className="text-sm text-charcoal-lighter">Monitor and manage suspicious order activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { icon: AlertTriangle, iconColor: "text-warning", value: stats.flagged, label: "Flagged" },
          { icon: Eye, iconColor: "text-secondary", value: stats.reviewed, label: "Under Review" },
          { icon: ShieldX, iconColor: "text-destructive", value: stats.blocked, label: "Blocked" },
          { icon: ShieldCheck, iconColor: "text-success", value: stats.cleared, label: "Cleared" },
          { icon: Shield, iconColor: "text-charcoal-lighter", value: stats.total, label: "Total Alerts" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card>
              <CardContent className="p-4 text-center">
                <stat.icon className={cn("h-5 w-5 mx-auto mb-1", stat.iconColor)} />
                <p className="text-2xl font-bold text-charcoal [font-variant-numeric:tabular-nums]">{stat.value}</p>
                <p className="text-xs text-charcoal-lighter">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No fraud alerts" description="Fraud alerts will appear here when orders are marked as not received." />
      ) : (
        <div className="space-y-4">
          {alerts.map((alert, i) => {
            const config = statusConfig[alert.status];
            const StatusIcon = config.icon;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
              <Card>
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="font-mono font-bold text-charcoal text-sm">{alert.order_number}</code>
                        <Badge variant={config.variant} className="text-[10px]">
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-charcoal-lighter mb-3">
                        <span>Customer: <span className="text-charcoal font-medium">{alert.customer_name}</span></span>
                        <span>Phone: <span className="text-charcoal font-medium">{alert.customer_phone}</span></span>
                        <span>Amount: <span className="text-charcoal font-medium [font-variant-numeric:tabular-nums]">{formatCurrency(alert.amount)}</span></span>
                        <span className="hidden sm:inline">{new Date(alert.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>

                      {/* Risk Score */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs text-charcoal-lighter">Risk Score:</span>
                        <div className="flex-1 max-w-[200px]">
                          <div className="h-2 bg-pearl rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", getRiskBarColor(alert.risk_score))}
                              style={{ width: `${alert.risk_score}%` }}
                            />
                          </div>
                        </div>
                        <span className={cn("text-sm font-bold [font-variant-numeric:tabular-nums]", getRiskColor(alert.risk_score))}>
                          {alert.risk_score}/100
                        </span>
                      </div>

                      {/* Risk Factors */}
                      <div className="flex flex-wrap gap-1.5">
                        {(alert.risk_factors || []).map((factor) => (
                          <span key={factor} className="text-[10px] bg-destructive/5 text-destructive border border-destructive/10 px-2 py-0.5 rounded-full">
                            {factor}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    {alert.status === "flagged" && (
                      <div className="flex flex-wrap sm:flex-col gap-2 flex-shrink-0">
                        <AdminButton size="sm" onClick={() => handleStatusUpdate(alert.id, "cleared")}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Clear
                        </AdminButton>
                        <AdminButton variant="outline" size="sm" onClick={() => handleStatusUpdate(alert.id, "reviewed")}>
                          <Eye className="h-3 w-3 mr-1" /> Review
                        </AdminButton>
                        <AdminButton variant="outline" size="sm" className="text-destructive border-destructive/30" onClick={() => handleStatusUpdate(alert.id, "blocked")}>
                          <Ban className="h-3 w-3 mr-1" /> Block
                        </AdminButton>
                      </div>
                    )}
                    {alert.status === "reviewed" && (
                      <div className="flex flex-wrap sm:flex-col gap-2 flex-shrink-0">
                        <AdminButton size="sm" onClick={() => handleStatusUpdate(alert.id, "cleared")}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Clear
                        </AdminButton>
                        <AdminButton variant="outline" size="sm" className="text-destructive border-destructive/30" onClick={() => handleStatusUpdate(alert.id, "blocked")}>
                          <Ban className="h-3 w-3 mr-1" /> Block
                        </AdminButton>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
