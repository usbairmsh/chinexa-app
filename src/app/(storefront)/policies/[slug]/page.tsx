import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { query } from "@/lib/db";
import { DEFAULT_POLICY_PAGES, type PolicyPage } from "@/types/policy";

async function getPolicy(slug: string): Promise<PolicyPage | null> {
  try {
    const rows = await query("SELECT value FROM settings WHERE `key` = 'policy_pages' LIMIT 1");
    const raw = rows.length > 0 ? rows[0].value : null;
    const policies: PolicyPage[] = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : DEFAULT_POLICY_PAGES;
    return (Array.isArray(policies) && policies.length > 0 ? policies : DEFAULT_POLICY_PAGES).find((p) => p.slug === slug) || null;
  } catch {
    return DEFAULT_POLICY_PAGES.find((p) => p.slug === slug) || null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const policy = await getPolicy(slug);
  if (!policy) return { title: "Policy", robots: { index: false, follow: true } };
  return {
    title: `${policy.title} — ChineXa`,
    description: policy.intro,
    alternates: { canonical: `/policies/${slug}` },
  };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = await getPolicy(slug);
  if (!policy) notFound();

  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Breadcrumb items={[{ label: policy.title }]} className="mb-8" />

        <div className="rounded-2xl border border-border/60 shadow-card p-6 sm:p-10">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-3">{policy.title}</h1>
          <p className="text-charcoal-lighter mb-10">{policy.intro}</p>

          <div className="space-y-8">
            {policy.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-heading text-xl font-semibold text-charcoal mb-3">{section.heading}</h2>
                <ul className="space-y-2">
                  {section.body.map((line, i) => (
                    <li key={i} className="text-sm leading-relaxed text-charcoal-light flex gap-2">
                      <span className="text-secondary mt-1.5 h-1 w-1 rounded-full bg-secondary shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <p className="text-xs text-charcoal-lighter mt-12 pt-6 border-t border-border/30">
            Last updated: July 2026. If you have questions about this policy, please contact us.
          </p>
        </div>
      </div>
    </div>
  );
}
