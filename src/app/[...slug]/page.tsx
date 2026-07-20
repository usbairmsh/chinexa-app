import { notFound, redirect, permanentRedirect } from "next/navigation";
import { getRedirectForPath } from "@/lib/redirects";

// Root catch-all: Next.js only routes here when NO real route matched the
// request, which makes it the perfect (and zero-overhead) place to apply
// admin-managed URL redirects — an old/dead URL can be rescued, but a live
// page can never be shadowed, because real routes always win over this one.
export const dynamic = "force-dynamic";

export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const path = "/" + slug.map((s) => decodeURIComponent(s)).join("/");

  const match = await getRedirectForPath(path);
  if (match) {
    if (match.type === 302) redirect(match.to);
    permanentRedirect(match.to);
  }

  notFound();
}
