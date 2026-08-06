import * as XLSX from "xlsx";
import type { PolicyPage, PolicySection } from "@/types/policy";

// Bulk policy import/export via Excel. A policy is nested (policy → sections →
// body paragraphs) but Excel is flat, so the format is ONE ROW PER SECTION:
//   slug | title | intro | section_heading | section_body
// - Rows sharing a `slug` group into one policy (title/intro taken from the
//   first row of that slug; blank slug rows attach to the policy above).
// - `section_body` holds the section's paragraphs, one per line (Alt+Enter in
//   Excel) — each line becomes one body[] entry.

const HEADERS = ["slug", "title", "intro", "section_heading", "section_body"] as const;

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Build and trigger a download of the Excel template with example rows. */
export function downloadPolicyTemplate() {
  const rows: (string)[][] = [
    [...HEADERS],
    [
      "shipping", "Shipping Policy",
      "We deliver across Bangladesh through trusted courier partners.",
      "Delivery Coverage & Timelines",
      "Dhaka City: 1-2 business days.\nOther divisions: 3-7 business days.",
    ],
    [
      "shipping", "", "",
      "Delivery Charges",
      "Charges are calculated at checkout.\nOrders above ৳3,000 qualify for free standard delivery.",
    ],
    [
      "returns", "Return Policy",
      "Not happy with your order? Here's how returns work.",
      "Eligibility",
      "Items must be unopened and in original packaging.\nRequest a return within 7 days of delivery.",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 16 }, { wch: 22 }, { wch: 40 }, { wch: 28 }, { wch: 50 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Policies");
  XLSX.writeFile(wb, "policy-upload-template.xlsx");
}

export interface ParseResult {
  policies: PolicyPage[];
  errors: string[];
}

/** Parse an uploaded Excel file (browser File) into policies + row-level errors. */
export async function parsePolicyExcel(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { policies: [], errors: ["The file has no sheets."] };

  // Row objects keyed by header. defval "" so missing cells are empty strings.
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const errors: string[] = [];

  // Validate the header set (case-insensitive, order-independent).
  if (raw.length === 0) return { policies: [], errors: ["The sheet is empty."] };
  const presentKeys = Object.keys(raw[0]).map((k) => k.trim().toLowerCase());
  const missing = HEADERS.filter((h) => !presentKeys.includes(h));
  if (missing.length) {
    return { policies: [], errors: [`Missing column(s): ${missing.join(", ")}. Download the template for the correct format.`] };
  }

  const get = (row: Record<string, unknown>, key: string): string => {
    // Case-insensitive column lookup.
    const found = Object.keys(row).find((k) => k.trim().toLowerCase() === key);
    return found ? String(row[found] ?? "").trim() : "";
  };

  // Group rows into policies, preserving order. Blank-slug rows attach to the
  // most recent policy.
  const bySlug = new Map<string, PolicyPage>();
  const order: string[] = [];
  let currentSlug = "";

  raw.forEach((row, i) => {
    const rowNum = i + 2; // +2: header row + 1-indexed
    let slug = get(row, "slug");
    const title = get(row, "title");
    const intro = get(row, "intro");
    const heading = get(row, "section_heading");
    const bodyRaw = get(row, "section_body");

    // Fully blank row — skip silently.
    if (!slug && !title && !intro && !heading && !bodyRaw) return;

    // Determine which policy this row belongs to.
    if (!slug) {
      if (!currentSlug) { errors.push(`Row ${rowNum}: no slug, and no policy above to attach to.`); return; }
      slug = currentSlug;
    } else {
      slug = slugify(slug) || slugify(title);
      if (!slug) { errors.push(`Row ${rowNum}: slug (or title) is required.`); return; }
    }

    // New policy: needs a title on its first row.
    if (!bySlug.has(slug)) {
      if (!title) { errors.push(`Row ${rowNum}: the first row of policy "${slug}" needs a title.`); return; }
      bySlug.set(slug, { slug, title, intro, sections: [] });
      order.push(slug);
    }
    currentSlug = slug;
    const policy = bySlug.get(slug)!;

    // A section row (has a heading and/or body). Some rows only set title/intro.
    if (heading || bodyRaw) {
      if (!heading) { errors.push(`Row ${rowNum}: section_body present but section_heading is empty.`); return; }
      const body = bodyRaw
        .split(/\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean);
      const section: PolicySection = { heading, body: body.length ? body : [""] };
      policy.sections.push(section);
    }
  });

  // A policy with no sections is invalid.
  const policies: PolicyPage[] = [];
  for (const slug of order) {
    const p = bySlug.get(slug)!;
    if (p.sections.length === 0) {
      errors.push(`Policy "${p.title}" (${slug}) has no sections — add at least one section row.`);
      continue;
    }
    policies.push(p);
  }

  return { policies, errors };
}
