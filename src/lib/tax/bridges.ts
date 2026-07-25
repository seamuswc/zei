/** Cross-chain bridges — not taxable when beneficial ownership unchanged. */
export const BRIDGE_ASSETS = new Set([
  "ETH",
  "WETH",
  "BTC",
  "WBTC",
  "USDC",
  "USDT",
  "DAI",
  "SOL",
  "MATIC",
  "POL",
  "ARB",
  "OP",
  "AVAX",
  "BNB",
]);

/**
 * Bridge moves the same economic asset across chains.
 * Tax: not a disposal. Cost basis stays with the asset (tracked under same symbol).
 */
export function isBridgeableAsset(asset: string): boolean {
  return BRIDGE_ASSETS.has(asset.toUpperCase());
}
