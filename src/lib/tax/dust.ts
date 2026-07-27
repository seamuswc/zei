import type { CryptoTx } from "./types";

/**
 * Dust rule (ledger cleanup):
 * remove txs where |qty| < 1e-6 OR (|jpyValue| < 1 && |qty| < 0.01).
 */
export function isDustTx(tx: Pick<CryptoTx, "quantity" | "jpyValue">): boolean {
  const qty = Math.abs(tx.quantity);
  const jpy = Math.abs(tx.jpyValue);
  return qty < 1e-6 || (jpy < 1 && qty < 0.01);
}

export function dustTxIds(txs: CryptoTx[]): string[] {
  return txs.filter(isDustTx).map((tx) => tx.id);
}
