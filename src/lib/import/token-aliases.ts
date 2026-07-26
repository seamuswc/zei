/**
 * Central token alias maps for wallet import pricing + classification.
 *
 * How to add a new coin
 * ---------------------
 * 1. SYMBOL_TO_COINGECKO — ticker → CoinGecko id (verify via /search or /coins/{id}).
 * 2. If it is an interest-bearing receipt (Aave aToken, etc.):
 *    ATOKEN_TO_UNDERLYING — receipt ticker → underlying ticker (priced via underlying).
 * 3. Optional LEGACY_TO_CURRENT — old ticker → successor (display stays chain symbol;
 *    historical pricing still uses SYMBOL_TO_COINGECKO for the old ticker).
 * 4. Optional: add the ERC-20 contract to ERC20_SYMBOLS in prices-data.ts
 *    (decimals + coinId) so wallet sync recognizes it without relying on Etherscan symbols.
 * 5. Re-sync the wallet (no automatic ledger migration).
 */

/** Ticker (uppercase) → CoinGecko coin id. */
export const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  DOT: "polkadot",
  MATIC: "matic-network",
  POL: "polygon-ecosystem-token",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  UNI: "uniswap",
  /** Current Aave governance token. */
  AAVE: "aave",
  /**
   * ETHLend / Aave [OLD] — pre-migration ticker LEND.
   * CoinGecko id is `ethlend` (name: "Aave [OLD]").
   */
  LEND: "ethlend",
  ARB: "arbitrum",
  OP: "optimism",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  BNB: "binancecoin",
  ATOM: "cosmos",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  NEAR: "near",
  APT: "aptos",
  SUI: "sui",
  PEPE: "pepe",
  SHIB: "shiba-inu",
  WETH: "weth",
  WBTC: "wrapped-bitcoin",
  WMATIC: "wmatic",
  WPOL: "wmatic",
  WSOL: "wrapped-solana",
  CRV: "curve-dao-token",
  MKR: "maker",
  SNX: "havven",
  YFI: "yearn-finance",
  BAT: "basic-attention-token",
  ZRX: "0x",
  ENJ: "enjincoin",
  MANA: "decentraland",
  KNC: "kyber-network-crystal",
  COMP: "compound-governance-token",
  MNT: "mantle",
  STETH: "staked-ether",
  WSTETH: "wrapped-steth",
  RETH: "rocket-pool-eth",
  CBETH: "coinbase-wrapped-staked-eth",
  GRT: "the-graph",
  LDO: "lido-dao",
  ENS: "ethereum-name-service",
  RNDR: "render-token",
  RENDER: "render-token",
  IMX: "immutable-x",
  SAND: "the-sandbox",
  AXS: "axie-infinity",
  SUSD: "nusd",
  TUSD: "true-usd",
  BUSD: "binance-usd",
  FRAX: "frax",
  GUSD: "gemini-dollar",
};

/**
 * Aave (and similar) interest-bearing receipt → underlying traded asset.
 * Price the aToken with the underlying CoinGecko series; do not treat
 * underlying↔aToken at the same hash as a crypto↔crypto trade.
 */
export const ATOKEN_TO_UNDERLYING: Record<string, string> = {
  // Aave V1-style (often shown as aETH / aLEND; Etherscan uppercases → AETH / ALEND)
  AETH: "ETH",
  ALEND: "LEND",
  ADAI: "DAI",
  AUSDC: "USDC",
  AUSDT: "USDT",
  ALINK: "LINK",
  AWBTC: "WBTC",
  // Aave V2/V3 common spellings
  AWETH: "ETH",
  AAAVE: "AAVE",
  ASUSD: "SUSD",
  ATUSD: "TUSD",
  ABUSD: "BUSD",
  ACRV: "CRV",
  AMKR: "MKR",
  ASNX: "SNX",
  AYFI: "YFI",
  ABAT: "BAT",
  AZRX: "ZRX",
  AENJ: "ENJ",
  AMANA: "MANA",
  AREP: "REP",
  AKNC: "KNC",
  AUNI: "UNI",
  ASTETH: "ETH",
  AWSTETH: "WSTETH",
  ARETH: "RETH",
  ACBETH: "CBETH",
  ACOMP: "COMP",
  AGRT: "GRT",
  ALDO: "LDO",
  AFRAX: "FRAX",
  AGUSD: "GUSD",
  // Variable debt tokens (not receipt aTokens — map for pricing only)
  VARIABLEDEBTWETH: "ETH",
  VARIABLEDEBTUSDC: "USDC",
  VARIABLEDEBTUSDT: "USDT",
  VARIABLEDEBTDAI: "DAI",
};

/**
 * Rebranded / migrated tickers. Ledger display keeps the chain symbol;
 * use this only for notes / future UX, not for renaming rows.
 * LEND still prices as `ethlend` via SYMBOL_TO_COINGECKO.
 */
export const LEGACY_TO_CURRENT: Record<string, string> = {
  LEND: "AAVE",
};

export function normalizeSymbol(asset: string): string {
  return asset.trim().toUpperCase();
}

/** Underlying ticker if `asset` is a known aToken; otherwise null. */
export function underlyingOfAToken(asset: string): string | null {
  return ATOKEN_TO_UNDERLYING[normalizeSymbol(asset)] ?? null;
}

export function isAToken(asset: string): boolean {
  return underlyingOfAToken(asset) != null;
}

/**
 * True when one leg is an aToken and the other is its underlying
 * (e.g. LEND↔ALEND, DAI↔ADAI, ETH↔AETH/AWETH).
 */
export function isATokenUnderlyingPair(a: string, b: string): boolean {
  const A = normalizeSymbol(a);
  const B = normalizeSymbol(b);
  if (ATOKEN_TO_UNDERLYING[A] === B) return true;
  if (ATOKEN_TO_UNDERLYING[B] === A) return true;
  // aWETH ↔ WETH (underlying map points AWETH→ETH; also accept WETH)
  if (A === "AWETH" && B === "WETH") return true;
  if (B === "AWETH" && A === "WETH") return true;
  return false;
}

/**
 * CoinGecko id for a ticker, resolving aTokens through their underlying.
 * Returns `{ coinId, viaUnderlying }` so callers can set priceSource.
 */
export function resolveCoinId(asset: string): {
  coinId: string | null;
  viaUnderlying: boolean;
  pricedAs: string | null;
} {
  const sym = normalizeSymbol(asset);
  const direct = SYMBOL_TO_COINGECKO[sym];
  if (direct) {
    return { coinId: direct, viaUnderlying: false, pricedAs: sym };
  }
  const underlying = ATOKEN_TO_UNDERLYING[sym];
  if (underlying) {
    const coinId = SYMBOL_TO_COINGECKO[normalizeSymbol(underlying)] ?? null;
    return {
      coinId,
      viaUnderlying: coinId != null,
      pricedAs: coinId ? underlying : null,
    };
  }
  return { coinId: null, viaUnderlying: false, pricedAs: null };
}

export function coinIdForAsset(asset: string): string | null {
  return resolveCoinId(asset).coinId;
}
