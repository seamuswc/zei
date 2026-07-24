/** Canonical wrap pairs — non-taxable identity changes, cost basis carries. */
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

export function isWrapPair(a: string, b: string): boolean {
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  return WRAP_PAIRS[A] === B;
}

export function wrappedForm(asset: string): string | null {
  return WRAP_PAIRS[asset.toUpperCase()] ?? null;
}
