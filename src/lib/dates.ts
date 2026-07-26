/**
 * Calendar date helpers for Japan tax (Asia/Tokyo).
 * Chain timestamps are UTC seconds; filing uses the Tokyo calendar day.
 */

/** YYYY-MM-DD in Asia/Tokyo for a unix timestamp (sec or ms) or Date. */
export function tokyoDateFromTs(ts: number | Date): string {
  const d =
    ts instanceof Date
      ? ts
      : new Date(ts > 1e12 ? ts : ts * 1000);
  if (Number.isNaN(d.getTime())) return "";
  // en-CA → YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Parse ISO / exchange timestamp strings into Tokyo YYYY-MM-DD. */
export function tokyoDateFromUnknown(ts: number | string | Date): string {
  if (ts instanceof Date) return tokyoDateFromTs(ts);
  if (typeof ts === "number") return tokyoDateFromTs(ts);
  const s = ts.trim();
  if (!s) return "";
  // Already a bare date
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return tokyoDateFromTs(d);
}
