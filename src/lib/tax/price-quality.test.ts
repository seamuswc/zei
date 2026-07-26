import type { CryptoTx } from "./types";
import {
  exportBlockedByMissingPrices,
  txsNeedingPrice,
} from "./price-quality";

function tx(partial: Partial<CryptoTx> & Pick<CryptoTx, "id" | "side">): CryptoTx {
  return {
    date: "2025-06-01",
    asset: "ETH",
    quantity: 1,
    jpyValue: 100_000,
    source: "wallet",
    ...partial,
  };
}

{
  const rows = [
    tx({ id: "ok", side: "sell", jpyValue: 100_000, priceSource: "coingecko_history" }),
    tx({ id: "bad", side: "sell", jpyValue: 0, priceSource: "unknown" }),
    tx({ id: "inc", side: "income", jpyValue: 0, priceSource: "unknown" }),
    tx({ id: "ex", side: "sell", jpyValue: 0, priceSource: "unknown", excluded: true }),
    tx({ id: "buy", side: "buy", jpyValue: 0, priceSource: "unknown" }),
    tx({ id: "old", side: "sell", date: "2024-01-01", jpyValue: 0, priceSource: "unknown" }),
  ];
  const need = txsNeedingPrice(rows, 2025);
  if (need.length !== 2) {
    throw new Error(`expected 2 needing price, got ${need.length}`);
  }
  if (!exportBlockedByMissingPrices(rows, 2025)) {
    throw new Error("export should be blocked");
  }
  if (exportBlockedByMissingPrices(rows.filter((t) => t.id === "ok"), 2025)) {
    throw new Error("clean year should export");
  }
}

console.log("price-quality checks ok");
