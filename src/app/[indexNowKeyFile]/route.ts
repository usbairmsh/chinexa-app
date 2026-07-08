import { NextRequest, NextResponse } from "next/server";

// Serves the IndexNow key-verification file at the site root, e.g.
// https://chinexabd.com/abc123def456.txt — the filename (minus ".txt") must
// exactly equal INDEXNOW_KEY for search engines to trust pings signed with
// that key. Falls through to a normal 404 for any other single-segment path,
// so this doesn't swallow unrelated top-level routes.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ indexNowKeyFile: string }> }) {
  const key = process.env.INDEXNOW_KEY;
  const { indexNowKeyFile } = await params;

  if (!key || indexNowKeyFile !== `${key}.txt`) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(key, { status: 200, headers: { "Content-Type": "text/plain" } });
}
