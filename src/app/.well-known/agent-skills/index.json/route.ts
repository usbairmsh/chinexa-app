import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-static";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

// Agent Skills Discovery index (agentskills.io / Cloudflare RFC v0.2.0).
// Digests are computed from the real files on disk at request time so the
// index can never silently drift out of sync with an edited SKILL.md.
const SKILLS = [
  {
    name: "browse-products",
    type: "skill-md" as const,
    description: "Search, filter, and read ChineXa's product catalog via the public REST API — no authentication required.",
    file: "browse-products/SKILL.md",
  },
  {
    name: "fetch-as-markdown",
    type: "skill-md" as const,
    description: "Fetch ChineXa product, blog, category, brand, and policy pages as clean Markdown via an Accept: text/markdown header.",
    file: "fetch-as-markdown/SKILL.md",
  },
];

export async function GET() {
  const skills = await Promise.all(
    SKILLS.map(async (s) => {
      const filePath = path.join(process.cwd(), "public", ".well-known", "agent-skills", s.file);
      const contents = await readFile(filePath);
      const digest = createHash("sha256").update(contents).digest("hex");
      return {
        name: s.name,
        type: s.type,
        description: s.description,
        url: `${siteUrl}/.well-known/agent-skills/${s.file}`,
        digest: `sha256:${digest}`,
      };
    })
  );

  return NextResponse.json(
    {
      $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
      skills,
    },
    { headers: { "Content-Type": "application/json; charset=utf-8" } }
  );
}
