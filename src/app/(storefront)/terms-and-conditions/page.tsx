import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PolicyTabs } from "@/components/storefront/policies/policy-tabs";
import { query } from "@/lib/db";
import { DEFAULT_POLICY_PAGES, type PolicyPage } from "@/types/policy";

// Load every policy from the admin-managed policy_pages setting. New policies
// added in the admin automatically appear here as new tabs — no code change.
async function getPolicies(): Promise<PolicyPage[]> {
  try {
    const rows = await query("SELECT value FROM settings WHERE `key` = 'policy_pages' LIMIT 1");
    const raw = rows.length > 0 ? rows[0].value : null;
    const policies: PolicyPage[] = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : DEFAULT_POLICY_PAGES;
    return Array.isArray(policies) && policies.length > 0 ? policies : DEFAULT_POLICY_PAGES;
  } catch {
    return DEFAULT_POLICY_PAGES;
  }
}

export const metadata: Metadata = {
  title: "Terms & Conditions — ChineXa",
  description: "ChineXa's policies — shipping, returns & refunds, cancellation, authenticity, loyalty, privacy and terms of service.",
  alternates: { canonical: "/terms-and-conditions" },
};

export default async function TermsAndConditionsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [policies, sp] = await Promise.all([getPolicies(), searchParams]);

  return (
    <div className="bg-card min-h-screen">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Breadcrumb items={[{ label: "Terms & Conditions" }]} className="mb-6" />
        <div className="mb-6 sm:mb-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal">Terms &amp; Conditions</h1>
          <p className="text-sm sm:text-base text-charcoal-lighter mt-2 max-w-2xl">
            Everything you need to know about shopping with ChineXa. Select a policy to read it.
          </p>
        </div>

        {policies.length === 0 ? (
          <p className="text-sm text-charcoal-lighter">No policies are published yet.</p>
        ) : (
          <PolicyTabs policies={policies} initialSlug={sp.tab} />
        )}
      </div>
    </div>
  );
}
