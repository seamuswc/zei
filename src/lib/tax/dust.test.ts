import { dustTxIds, isDustTx } from "./dust";
import type { CryptoTx } from "./types";

function tx(
  partial: Partial<CryptoTx> & Pick<CryptoTx, "id" | "quantity" | "jpyValue">,
): CryptoTx {
  return {
    date: "2025-06-01",
    asset: "ETH",
    side: "fee",
    source: "wallet",
    ...partial,
  };
}

{
  if (!isDustTx({ quantity: 1e-7, jpyValue: 100 })) {
    throw new Error("tiny qty should be dust");
  }
  if (!isDustTx({ quantity: 0.005, jpyValue: 0.5 })) {
    throw new Error("sub-yen with small qty should be dust");
  }
  if (isDustTx({ quantity: 0.005, jpyValue: 1 })) {
    throw new Error("¥1 with qty 0.005 should not be dust");
  }
  if (isDustTx({ quantity: 0.02, jpyValue: 0 })) {
    throw new Error("qty >= 0.01 with ¥0 should not be dust");
  }
  if (!isDustTx({ quantity: 0, jpyValue: 0 })) {
    throw new Error("zero qty should be dust");
  }
  if (isDustTx({ quantity: 1, jpyValue: 0.5 })) {
    throw new Error("normal qty with sub-yen should not be dust");
  }

  const ids = dustTxIds([
    tx({ id: "keep", quantity: 1, jpyValue: 100 }),
    tx({ id: "dust-qty", quantity: 1e-9, jpyValue: 50 }),
    tx({ id: "dust-jpy", quantity: 0.001, jpyValue: 0 }),
  ]);
  if (ids.join(",") !== "dust-qty,dust-jpy") {
    throw new Error(`unexpected dust ids: ${ids.join(",")}`);
  }
}
