import type { CryptoTx } from "@/lib/tax/types";
import { isWrapPair } from "@/lib/tax/wraps";

/**
 * Collapse same-hash ETH↔WETH (etc.) buy+sell into a non-taxable wrap.
 */
export function collapseWraps(txs: CryptoTx[]): CryptoTx[] {
  const byHash = new Map<string, CryptoTx[]>();
  for (const t of txs) {
    if (!t.txHash) continue;
    const list = byHash.get(t.txHash) ?? [];
    list.push(t);
    byHash.set(t.txHash, list);
  }

  const remove = new Set<string>();
  const add: CryptoTx[] = [];

  for (const [, group] of byHash) {
    const legs = group.filter(
      (t) => t.side === "buy" || t.side === "sell",
    );
    if (legs.length < 2) continue;

    for (let i = 0; i < legs.length; i++) {
      for (let j = i + 1; j < legs.length; j++) {
        const a = legs[i];
        const b = legs[j];
        if (a.side === b.side) continue;
        if (!isWrapPair(a.asset, b.asset)) continue;
        const sell = a.side === "sell" ? a : b;
        const buy = a.side === "buy" ? a : b;
        if (sell.asset.toUpperCase() === buy.asset.toUpperCase()) continue;
        // qty roughly equal
        const mid = (sell.quantity + buy.quantity) / 2;
        if (Math.abs(sell.quantity - buy.quantity) > Math.max(mid * 0.02, 1e-8)) {
          continue;
        }
        remove.add(sell.id);
        remove.add(buy.id);
        add.push({
          id: `wrap_${sell.id}`,
          date: sell.date,
          asset: sell.asset.toUpperCase(),
          side: "wrap",
          quantity: sell.quantity,
          jpyValue: 0,
          source: sell.source,
          note: `wrap ${sell.asset}→${buy.asset} (not taxed)`,
          txHash: sell.txHash,
          counterAsset: buy.asset.toUpperCase(),
          priceSource: "derived_trade",
        });
      }
    }
  }

  if (!remove.size) return txs;
  return [...txs.filter((t) => !remove.has(t.id)), ...add].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
