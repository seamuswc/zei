import type { CryptoTx } from "@/lib/tax/types";

/**
 * Merge local ∪ server ledger by tx id.
 * On id conflict: keep local unless server carries a newer `updatedAt` (optional field).
 * Without timestamps, local wins so cloud hydrate does not clobber unsaved edits.
 */
export function mergeLedgerById(
  local: CryptoTx[],
  server: CryptoTx[],
): CryptoTx[] {
  type Row = CryptoTx & { updatedAt?: string };
  const byId = new Map<string, Row>();

  for (const t of local as Row[]) {
    byId.set(t.id, t);
  }

  for (const t of server as Row[]) {
    const prev = byId.get(t.id);
    if (!prev) {
      byId.set(t.id, t);
      continue;
    }
    const localTs = prev.updatedAt ? Date.parse(prev.updatedAt) : NaN;
    const serverTs = t.updatedAt ? Date.parse(t.updatedAt) : NaN;
    if (Number.isFinite(serverTs) && Number.isFinite(localTs)) {
      if (serverTs > localTs) byId.set(t.id, t);
      continue;
    }
    if (Number.isFinite(serverTs) && !Number.isFinite(localTs)) {
      byId.set(t.id, t);
      continue;
    }
    // No usable timestamps → keep local
  }

  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
}
