import type { CryptoTx } from "@/lib/tax/types";

const PRICE_SIDES = new Set(["sell", "income"]);

/**
 * Active sell/income rows in `year` with unknown or non-positive JPY.
 * Excluded rows are ignored. These must be fixed (or excluded) before ZIP export.
 */
export function txsNeedingPrice(txs: CryptoTx[], year: number): CryptoTx[] {
  const prefix = `${year}-`;
  return txs.filter((t) => {
    if (t.excluded) return false;
    if (!t.date.startsWith(prefix)) return false;
    if (!PRICE_SIDES.has(t.side)) return false;
    if (t.priceSource === "unknown") return true;
    if (!(t.jpyValue > 0)) return true;
    return false;
  });
}

export function exportBlockedByMissingPrices(
  txs: CryptoTx[],
  year: number,
): boolean {
  return txsNeedingPrice(txs, year).length > 0;
}

/** Sell/income rows (any year) with unknown or ¥0 JPY — used by Review UX. */
export function txNeedsPrice(tx: CryptoTx): boolean {
  if (tx.excluded) return false;
  if (!PRICE_SIDES.has(tx.side)) return false;
  if (tx.priceSource === "unknown") return true;
  if (!(tx.jpyValue > 0)) return true;
  return false;
}

/**
 * Rows that should surface in Review first: missing price on taxable sides,
 * or auto-classified transfers / uncertain DeFi notes marked for Review.
 */
export function txNeedsReview(tx: CryptoTx): boolean {
  if (tx.excluded) return false;
  if (txNeedsPrice(tx)) return true;
  const note = tx.note ?? "";
  if (note.includes("(check Review)")) return true;
  if (
    (tx.side === "transfer_in" || tx.side === "transfer_out") &&
    note.startsWith("auto:")
  ) {
    return true;
  }
  return false;
}

/** Count unpriced sell/income among a freshly synced batch (any year). */
export function countNeedsPrice(txs: CryptoTx[]): number {
  return txs.filter(txNeedsPrice).length;
}
