import { resolveJpyUnitPrice, type PriceHint } from "@/lib/import/prices";

const BINANCE_JPY: Record<string, string> = {
  BTC: "BTCJPY",
  ETH: "ETHJPY",
  XRP: "XRPJPY",
  SOL: "SOLJPY",
  BNB: "BNBJPY",
  ADA: "ADAJPY",
  DOGE: "DOGEJPY",
  LTC: "LTCJPY",
  LINK: "LINKJPY",
  AVAX: "AVAXJPY",
  DOT: "DOTJPY",
  ATOM: "ATOMJPY",
  NEAR: "NEARJPY",
};

/** Public market mid used as on-chain/public quote when fills are absent. */
export async function fetchPublicOnchainJpy(
  asset: string,
): Promise<number | null> {
  const symbol = BINANCE_JPY[asset.toUpperCase()];
  if (symbol) {
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = (await res.json()) as { price?: string };
        const n = Number(data.price);
        if (n > 0) return n;
      }
    } catch {
      /* fall through */
    }
  }

  // DexScreener USD → JPY via USDTJPY-ish from BTCJPY/BTCUSDT when possible
  try {
    const q = encodeURIComponent(asset.toUpperCase());
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${q}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      pairs?: Array<{ priceUsd?: string; liquidity?: { usd?: number } }>;
    };
    const pair = (data.pairs || [])
      .filter((p) => Number(p.priceUsd) > 0)
      .sort(
        (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0),
      )[0];
    const usd = Number(pair?.priceUsd);
    if (!(usd > 0)) return null;

    const fx = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=BTCJPY",
      { cache: "no-store" },
    );
    const fxBtcUsdt = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
      { cache: "no-store" },
    );
    if (!fx.ok || !fxBtcUsdt.ok) return null;
    const jpy = Number(((await fx.json()) as { price: string }).price);
    const usdt = Number(((await fxBtcUsdt.json()) as { price: string }).price);
    if (!(jpy > 0 && usdt > 0)) return null;
    const usdJpy = jpy / usdt;
    return usd * usdJpy;
  } catch {
    return null;
  }
}

/** Resolve wallet/on-chain unit price with waterfall. */
export async function resolveWalletUnitPrice(
  asset: string,
  isoDate: string,
  hint: PriceHint = {},
) {
  if (hint.exchangeJpy || hint.onchainJpy || hint.manualJpy) {
    return resolveJpyUnitPrice(asset, isoDate, hint);
  }
  // Historical days: prefer CoinGecko history; for "today" try public on-chain mid first
  const today = new Date().toISOString().slice(0, 10);
  if (isoDate === today) {
    const onchain = await fetchPublicOnchainJpy(asset);
    if (onchain) {
      return resolveJpyUnitPrice(asset, isoDate, {
        ...hint,
        onchainJpy: onchain,
      });
    }
  }
  return resolveJpyUnitPrice(asset, isoDate, hint);
}
