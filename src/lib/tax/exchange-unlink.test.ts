import type { CryptoTx } from "./types";
import { exchangeTxMatchesId } from "./exchange-links";

function tx(partial: Partial<CryptoTx> & Pick<CryptoTx, "id">): CryptoTx {
  return {
    date: "2025-01-01",
    asset: "BTC",
    side: "buy",
    quantity: 1,
    jpyValue: 1_000_000,
    source: "exchange",
    ...partial,
  };
}

{
  const stamped = tx({ id: "1", exchangeId: "bitflyer", exchange: "bitFlyer" });
  if (!exchangeTxMatchesId(stamped, "bitflyer", { clearUnstampedExchangeSource: false })) {
    throw new Error("stamped exchangeId should match");
  }
  if (exchangeTxMatchesId(stamped, "coincheck", { clearUnstampedExchangeSource: false })) {
    throw new Error("other exchange must not match");
  }
}

{
  const byLabel = tx({ id: "2", exchange: "GMO Coin" });
  if (!exchangeTxMatchesId(byLabel, "gmo", { clearUnstampedExchangeSource: false })) {
    throw new Error("label should resolve to gmo");
  }
}

{
  const unstamped = tx({ id: "3", source: "exchange" });
  if (
    exchangeTxMatchesId(unstamped, "bitflyer", {
      clearUnstampedExchangeSource: false,
    })
  ) {
    throw new Error("unstamped should not match while other exchanges remain");
  }
  if (
    !exchangeTxMatchesId(unstamped, "bitflyer", {
      clearUnstampedExchangeSource: true,
    })
  ) {
    throw new Error("last-exchange unlink should clear unstamped exchange rows");
  }
}

{
  const wallet = tx({ id: "4", source: "wallet", exchange: undefined });
  if (
    exchangeTxMatchesId(wallet, "bitflyer", { clearUnstampedExchangeSource: true })
  ) {
    throw new Error("wallet rows must not be wiped by exchange unlink");
  }
}

console.log("exchange-unlink checks ok");
