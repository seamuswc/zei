import { getDb } from "@/lib/db";

/**
 * SQLite-backed rate limit (survives restarts; shared across PM2 workers).
 * Falls back to in-memory if DB is unavailable.
 */
const memory = new Map<string, { count: number; reset: number }>();

function ensureTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL
    );
  `);
  return db;
}

export function rateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  try {
    const db = ensureTable();
    const row = db
      .prepare(`SELECT count, reset_at FROM rate_limits WHERE key = ?`)
      .get(key) as { count: number; reset_at: number } | undefined;

    if (!row || row.reset_at < now) {
      db.prepare(
        `INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)`,
      ).run(key, now + windowMs);
      return { ok: true };
    }
    if (row.count >= limit) {
      return {
        ok: false,
        retryAfterSec: Math.ceil((row.reset_at - now) / 1000),
      };
    }
    db.prepare(`UPDATE rate_limits SET count = count + 1 WHERE key = ?`).run(
      key,
    );
    return { ok: true };
  } catch {
    const hit = memory.get(key);
    if (!hit || hit.reset < now) {
      memory.set(key, { count: 1, reset: now + windowMs });
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
}

/** Best-effort prune of expired buckets (call occasionally from hot paths). */
export function pruneRateLimits(maxAgeMs = 3600_000) {
  const cutoff = Date.now() - maxAgeMs;
  try {
    const db = ensureTable();
    db.prepare(`DELETE FROM rate_limits WHERE reset_at < ?`).run(cutoff);
  } catch {
    /* ignore */
  }
  for (const [k, v] of memory) {
    if (v.reset < cutoff) memory.delete(k);
  }
}
