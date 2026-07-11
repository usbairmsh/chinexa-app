// In-memory sliding-window rate limiter. Good enough for a single-process
// VPS deployment (confirmed: one `app` container in docker-compose.yml) —
// it resets on restart and doesn't share state across multiple instances,
// but that's an acceptable trade-off for closing an unlimited-attempts hole
// without standing up Redis or similar just for this.
const buckets = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup so `buckets` doesn't grow unboundedly over a long-running
// process — old entries are harmless individually, but never removing them
// is a slow memory leak across enough distinct keys (phone numbers, IPs) over
// weeks/months of uptime.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();
function cleanupIfDue() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

/**
 * Returns { limited: true } if `key` has exceeded `max` attempts within
 * `windowMs`, otherwise records this attempt and returns { limited: false }.
 * Call once per attempt (e.g. once per login/verify POST), not speculatively.
 */
export function checkRateLimit(key: string, max: number, windowMs: number): { limited: boolean; retryAfterMs: number } {
  cleanupIfDue();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfterMs: 0 };
  }

  if (bucket.count >= max) {
    return { limited: true, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { limited: false, retryAfterMs: 0 };
}

/** Best-effort client identifier for rate-limiting when no logged-in identity exists yet. */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
