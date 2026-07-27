/** Canonical wrap destinations — engine fallback when `counterAsset` is missing. */
export const WRAP_PAIRS: Record<string, string> = {
  ETH: "WETH",
  WETH: "ETH",
  BTC: "WBTC",
  WBTC: "BTC",
  MATIC: "WMATIC",
  WMATIC: "MATIC",
  POL: "WMATIC",
  SOL: "WSOL",
  WSOL: "SOL",
  BNB: "WBNB",
  WBNB: "BNB",
  AVAX: "WAVAX",
  WAVAX: "AVAX",
};

/**
 * Extra same-hash wrap edges (LST stake / wrap). ETH already maps to WETH in
 * WRAP_PAIRS, so these live as unordered edges checked by `isWrapPair`.
 */
const EXTRA_WRAP_EDGES: ReadonlyArray<readonly [string, string]> = [
  ["ETH", "STETH"],
  ["ETH", "RETH"],
  ["ETH", "CBETH"],
  ["ETH", "FRXETH"],
  ["STETH", "WSTETH"],
];

/** Share-rate wraps — quantities need not match ~1:1. */
const RATE_FLEXIBLE_EDGES = new Set(["STETH|WSTETH"]);

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const WRAP_EDGE_SET: Set<string> = (() => {
  const set = new Set<string>();
  for (const [a, b] of Object.entries(WRAP_PAIRS)) {
    if (a.toUpperCase() === b.toUpperCase()) continue;
    set.add(edgeKey(a.toUpperCase(), b.toUpperCase()));
  }
  for (const [a, b] of EXTRA_WRAP_EDGES) {
    set.add(edgeKey(a, b));
  }
  return set;
})();

export function isWrapPair(a: string, b: string): boolean {
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  if (A === B) return false;
  return WRAP_EDGE_SET.has(edgeKey(A, B));
}

/** True when wrap qty may differ (e.g. stETH ↔ wstETH share rate). */
export function isRateFlexibleWrap(a: string, b: string): boolean {
  return RATE_FLEXIBLE_EDGES.has(edgeKey(a.toUpperCase(), b.toUpperCase()));
}

export function wrappedForm(asset: string): string | null {
  return WRAP_PAIRS[asset.toUpperCase()] ?? null;
}
