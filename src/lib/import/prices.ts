import type { PriceSource } from "@/lib/tax/types";
import { resolveCoinId, ERC20_SYMBOLS } from "@/lib/import/prices-data";
import { isAToken } from "@/lib/import/token-aliases";

export {
  coinIdForAsset,
  resolveCoinId,
  ERC20_SYMBOLS,
  COIN_IDS,
} from "@/lib/import/prices-data";

export {
  SYMBOL_TO_COINGECKO,
  ATOKEN_TO_UNDERLYING,
  LEGACY_TO_CURRENT,
  isATokenUnderlyingPair,
  underlyingOfAToken,
} from "@/lib/import/token-aliases";

const mem = new Map<string, { jpy: number; source: PriceSource }>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * CoinGecko routing:
 * - No key → public api.coingecko.com
 * - Key set → pro-api.coingecko.com + x-cg-pro-api-key (Basic/Analyst/Lite/Enterprise)
 * - COINGECKO_USE_DEMO=1 → Demo host + x-cg-demo-api-key (Demo free tier only)
 * - COINGECKO_API_BASE overrides the root (still /api/v3 appended if missing)
 *
 * Note: paid "Basic" keys often start with `CG-` — prefix alone is NOT Demo.
 */
function useCoinGeckoDemo(): boolean {
  const v = (process.env.COINGECKO_USE_DEMO || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "demo";
}

function coingeckoHeaders(): HeadersInit {
  const key = (process.env.COINGECKO_API_KEY || "").trim();
  const headers: Record<string, string> = { accept: "application/json" };
  if (!key) return headers;
  if (useCoinGeckoDemo()) {
    headers["x-cg-demo-api-key"] = key;
  } else {
    headers["x-cg-pro-api-key"] = key;
  }
  return headers;
}

function coingeckoBase(): string {
  const override = (process.env.COINGECKO_API_BASE || "").trim().replace(/\/$/, "");
  if (override) {
    return override.endsWith("/api/v3") ? override : `${override}/api/v3`;
  }
  const key = (process.env.COINGECKO_API_KEY || "").trim();
  if (!key) return "https://api.coingecko.com/api/v3";
  if (useCoinGeckoDemo()) return "https://api.coingecko.com/api/v3";
  return "https://pro-api.coingecko.com/api/v3";
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

  const resolved = hint.coinId
    ? { coinId: hint.coinId, viaUnderlying: false }
    : resolveCoinId(assetKey);
  let coinId: string | null = resolved.coinId;
  let viaUnderlying = resolved.viaUnderlying;
  if (!coinId && hint.tokenContract) {
    coinId =
      ERC20_SYMBOLS[hint.tokenContract.toLowerCase()]?.coinId ?? null;
    if (coinId && isAToken(assetKey)) viaUnderlying = true;
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
  await sleep(process.env.COINGECKO_API_KEY ? 150 : 350);
  const histUrl = `${base}/coins/${coinId}/history?date=${date}&localization=false`;
  let histRes = await fetch(histUrl, {
    headers,
    next: { revalidate: 86400 },
  });
  if (histRes.status === 429 || histRes.status === 400) {
    await sleep(800);
    histRes = await fetch(histUrl, {
      headers,
      next: { revalidate: 86400 },
    });
  }
  if (histRes.ok) {
    const data = (await histRes.json()) as {
      market_data?: { current_price?: { jpy?: number } };
    };
    const jpy = data.market_data?.current_price?.jpy;
    if (typeof jpy === "number" && jpy > 0) {
      const out = {
        jpy,
        source: (viaUnderlying
          ? "coingecko_underlying"
          : "coingecko_history") as PriceSource,
      };
      mem.set(cacheKey, out);
      return out;
    }
  }

  await sleep(process.env.COINGECKO_API_KEY ? 150 : 350);
  const spotUrl = `${base}/simple/price?ids=${coinId}&vs_currencies=jpy`;
  let spotRes = await fetch(spotUrl, { headers, cache: "no-store" });
  if (spotRes.status === 429 || spotRes.status === 400) {
    await sleep(800);
    spotRes = await fetch(spotUrl, { headers, cache: "no-store" });
  }
  if (!spotRes.ok) {
    throw new Error(`CoinGecko failed for ${assetKey} (${spotRes.status})`);
  }
  const spot = (await spotRes.json()) as Record<string, { jpy?: number }>;
  const jpy = spot[coinId]?.jpy;
  if (!jpy) throw new Error(`No JPY price for ${assetKey}`);
  const out = {
    jpy,
    source: (viaUnderlying
      ? "coingecko_underlying"
      : "coingecko_spot") as PriceSource,
  };
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

/**
 * One CoinGecko range call → daily JPY map (fast wallet sync).
 * Falls back to a single spot price applied to all dates.
 */
export async function loadDailyJpySeries(
  coinId: string,
  fromIso: string,
  toIso: string,
): Promise<{ byDate: Map<string, number>; source: PriceSource }> {
  const from = Math.floor(new Date(`${fromIso}T00:00:00Z`).getTime() / 1000);
  const to = Math.ceil(new Date(`${toIso}T23:59:59Z`).getTime() / 1000);
  const base = coingeckoBase();
  const headers = coingeckoHeaders();
  await sleep(process.env.COINGECKO_API_KEY ? 120 : 280);
  const url = `${base}/coins/${coinId}/market_chart/range?vs_currency=jpy&from=${from}&to=${to}`;
  const res = await fetch(url, { headers, cache: "no-store" });
  const byDate = new Map<string, number>();

  if (res.ok) {
    const data = (await res.json()) as { prices?: [number, number][] };
    for (const row of data.prices ?? []) {
      const [ts, price] = row;
      if (!(price > 0)) continue;
      const day = new Date(ts).toISOString().slice(0, 10);
      byDate.set(day, price);
    }
    if (byDate.size > 0) {
      return { byDate, source: "coingecko_history" };
    }
  }

  await sleep(process.env.COINGECKO_API_KEY ? 120 : 280);
  const spotUrl = `${base}/simple/price?ids=${coinId}&vs_currencies=jpy`;
  const spotRes = await fetch(spotUrl, { headers, cache: "no-store" });
  if (!spotRes.ok) {
    throw new Error(`CoinGecko failed for ${coinId} (${spotRes.status})`);
  }
  const spot = (await spotRes.json()) as Record<string, { jpy?: number }>;
  const jpy = spot[coinId]?.jpy;
  if (!(jpy && jpy > 0)) throw new Error(`No JPY price for ${coinId}`);
  // Apply spot to the range endpoints so callers always find a value
  byDate.set(fromIso, jpy);
  byDate.set(toIso, jpy);
  return { byDate, source: "coingecko_spot" };
}

/** Nearest prior (or next) daily price from a series map. */
export function nearestDailyJpy(
  byDate: Map<string, number>,
  isoDate: string,
): number | null {
  const hit = byDate.get(isoDate);
  if (hit != null && hit > 0) return hit;
  const keys = [...byDate.keys()].sort();
  if (keys.length === 0) return null;
  let best: string | null = null;
  for (const k of keys) {
    if (k <= isoDate) best = k;
    else break;
  }
  if (best) return byDate.get(best) ?? null;
  return byDate.get(keys[0]) ?? null;
}
