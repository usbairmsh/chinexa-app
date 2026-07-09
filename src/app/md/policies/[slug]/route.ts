import { query } from "@/lib/db";
import { markdownResponse } from "@/lib/markdown-response";
import { DEFAULT_POLICY_PAGES, type PolicyPage } from "@/types/policy";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

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

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = await getPolicy(slug);

  if (!policy) {
    return markdownResponse(`# Not Found\n\nNo policy page found at this URL.\n`, { status: 404 });
  }

  const lines: string[] = [];
  lines.push(`# ${policy.title}`);
  lines.push("");
  lines.push(policy.intro);
  lines.push("");

  for (const section of policy.sections) {
    lines.push(`## ${section.heading}`);
    lines.push("");
    for (const line of section.body) lines.push(`- ${line}`);
    lines.push("");
  }

  lines.push(`[View on site](${siteUrl}/policies/${slug})`);

  return markdownResponse(lines.join("\n"));
}
