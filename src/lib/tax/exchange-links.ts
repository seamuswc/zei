import type { CryptoTx } from "@/lib/tax/types";

/** Map ledger `exchange` labels (or ids) → link badge ids. */
export const EXCHANGE_LINK_IDS: Record<string, string> = {
  bitflyer: "bitflyer",
  coincheck: "coincheck",
  gmo: "gmo",
  "gmo coin": "gmo",
  bitbank: "bitbank",
  "binance-jp": "binance-jp",
  "binance japan": "binance-jp",
  zaif: "zaif",
  binance: "binance",
  bybit: "bybit",
  okx: "okx",
  kraken: "kraken",
  kucoin: "kucoin",
  bitget: "bitget",
  gateio: "gateio",
  "gate.io": "gateio",
  gate: "gateio",
  mexc: "mexc",
  cryptocom: "cryptocom",
  "crypto.com": "cryptocom",
  coinbase: "coinbase",
  htx: "htx",
  huobi: "htx",
};

export function resolveExchangeLinkId(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (EXCHANGE_LINK_IDS[key]) return EXCHANGE_LINK_IDS[key];
  // Already a known link id
  if (Object.values(EXCHANGE_LINK_IDS).includes(key)) return key;
  return null;
}

/**
 * True when a ledger row belongs to the exchange being unlinked.
 * Prefers stamped `exchangeId`; falls back to resolving `exchange` labels.
 * When this is the last linked exchange, also drops unstamped `source:exchange`.
 */
export function exchangeTxMatchesId(
  t: CryptoTx,
  exchangeId: string,
  opts: { clearUnstampedExchangeSource: boolean },
): boolean {
  const target = exchangeId.trim().toLowerCase();
  if (!target) return false;

  const stamped = t.exchangeId?.trim().toLowerCase();
  if (stamped) {
    const resolved = resolveExchangeLinkId(stamped) ?? stamped;
    if (resolved === target) return true;
  }

  if (t.exchange) {
    const fromLabel = resolveExchangeLinkId(t.exchange);
    if (fromLabel === target) return true;
  }

  if (
    opts.clearUnstampedExchangeSource &&
    t.source === "exchange" &&
    !stamped &&
    !t.exchange
  ) {
    return true;
  }

  return false;
}
