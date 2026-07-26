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
