const buckets = new Map<string, { count: number; reset: number }>();

/** Simple in-memory rate limit (per process). */
export function rateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const hit = buckets.get(key);
  if (!hit || hit.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true };
  }
  if (hit.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((hit.reset - now) / 1000),
    };
  }
  hit.count += 1;
  return { ok: true };
}
