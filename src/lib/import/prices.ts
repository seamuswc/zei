import type { PriceSource } from "@/lib/tax/types";
import {
  coinIdForAsset,
  ERC20_SYMBOLS,
} from "@/lib/import/prices-data";

export {
  coinIdForAsset,
  ERC20_SYMBOLS,
  COIN_IDS,
} from "@/lib/import/prices-data";

const mem = new Map<string, { jpy: number; source: PriceSource }>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** CoinGecko Demo (`CG-…`) or Pro key. */
function coingeckoHeaders(): HeadersInit {
  const key = (process.env.COINGECKO_API_KEY || "").trim();
  const headers: Record<string, string> = { accept: "application/json" };
  if (!key) return headers;
  if (key.startsWith("CG-")) {
    headers["x-cg-demo-api-key"] = key;
  } else {
    headers["x-cg-pro-api-key"] = key;
  }
  return headers;
}

function coingeckoBase(): string {
  const key = (process.env.COINGECKO_API_KEY || "").trim();
  if (key && !key.startsWith("CG-")) {
    return "https://pro-api.coingecko.com/api/v3";
  }
  return "https://api.coingecko.com/api/v3";
}

export type PriceHint = {
  exchangeJpy?: number;
  onchainJpy?: number;
  manualJpy?: number;
  coinId?: string;
  tokenContract?: string;
};

/**
 * Price waterfall (Review manual always wins when user edits):
 * 1. Exchange fill
 * 2. On-chain quote (if provided)
 * 3. CoinGecko history → spot
 */
export async function resolveJpyUnitPrice(
  asset: string,
  isoDate: string,
  hint: PriceHint = {},
): Promise<{ jpy: number; source: PriceSource }> {
  if (hint.exchangeJpy != null && hint.exchangeJpy > 0) {
    return { jpy: hint.exchangeJpy, source: "exchange_fill" };
  }
  if (hint.onchainJpy != null && hint.onchainJpy > 0) {
    return { jpy: hint.onchainJpy, source: "onchain" };
  }
  if (hint.manualJpy != null && hint.manualJpy > 0) {
    return { jpy: hint.manualJpy, source: "manual" };
  }

  const assetKey = asset.toUpperCase();
  const cacheKey = `${hint.coinId ?? hint.tokenContract ?? assetKey}:${isoDate}`;
  const hit = mem.get(cacheKey);
  if (hit) return hit;

  let coinId: string | null = hint.coinId ?? coinIdForAsset(assetKey);
  if (!coinId && hint.tokenContract) {
    coinId =
      ERC20_SYMBOLS[hint.tokenContract.toLowerCase()]?.coinId ?? null;
  }
  if (!coinId) {
    throw new Error(
      `No price mapping for ${assetKey} — set JPY manually in Review`,
    );
  }

  const [y, m, d] = isoDate.split("-");
  const date = `${d}-${m}-${y}`;
  const base = coingeckoBase();
  const headers = coingeckoHeaders();
  // Demo key: lighter throttle; public unauthenticated: be polite
  await sleep(process.env.COINGECKO_API_KEY ? 120 : 320);
  const histUrl = `${base}/coins/${coinId}/history?date=${date}&localization=false`;
  const histRes = await fetch(histUrl, {
    headers,
    next: { revalidate: 86400 },
  });
  if (histRes.ok) {
    const data = (await histRes.json()) as {
      market_data?: { current_price?: { jpy?: number } };
    };
    const jpy = data.market_data?.current_price?.jpy;
    if (typeof jpy === "number" && jpy > 0) {
      const out = { jpy, source: "coingecko_history" as const };
      mem.set(cacheKey, out);
      return out;
    }
  }

  await sleep(process.env.COINGECKO_API_KEY ? 120 : 320);
  const spotUrl = `${base}/simple/price?ids=${coinId}&vs_currencies=jpy`;
  const spotRes = await fetch(spotUrl, { headers, cache: "no-store" });
  if (!spotRes.ok) {
    throw new Error(`CoinGecko failed for ${assetKey} (${spotRes.status})`);
  }
  const spot = (await spotRes.json()) as Record<string, { jpy?: number }>;
  const jpy = spot[coinId]?.jpy;
  if (!jpy) throw new Error(`No JPY price for ${assetKey}`);
  const out = { jpy, source: "coingecko_spot" as const };
  mem.set(cacheKey, out);
  return out;
}

export async function jpyUnitPrice(
  asset: string,
  isoDate: string,
  coinIdOverride?: string,
): Promise<{ jpy: number; source: PriceSource }> {
  return resolveJpyUnitPrice(asset, isoDate, { coinId: coinIdOverride });
}
