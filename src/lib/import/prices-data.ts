export const COIN_IDS: Record<string, string> = {
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
  AAVE: "aave",
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
  WSOL: "wrapped-solana",
};

export function coinIdForAsset(asset: string): string | null {
  return COIN_IDS[asset.toUpperCase()] ?? null;
}

export const ERC20_SYMBOLS: Record<
  string,
  { symbol: string; decimals: number; coinId?: string }
> = {
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
    symbol: "USDC",
    decimals: 6,
    coinId: "usd-coin",
  },
  "0xdac17f958d2ee523a2206206994597c13d831ec7": {
    symbol: "USDT",
    decimals: 6,
    coinId: "tether",
  },
  "0x6b175474e89094c44da98b954eedeac495271d0f": {
    symbol: "DAI",
    decimals: 18,
    coinId: "dai",
  },
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
    symbol: "WETH",
    decimals: 18,
    coinId: "weth",
  },
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": {
    symbol: "WBTC",
    decimals: 8,
    coinId: "wrapped-bitcoin",
  },
  "0x514910771af9ca656af840dff83e8264ecf986ca": {
    symbol: "LINK",
    decimals: 18,
    coinId: "chainlink",
  },
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": {
    symbol: "UNI",
    decimals: 18,
    coinId: "uniswap",
  },
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": {
    symbol: "AAVE",
    decimals: 18,
    coinId: "aave",
  },
  "0xb50721bdf60b66aa785914594174e9d9b2241ff2": {
    symbol: "ARB",
    decimals: 18,
    coinId: "arbitrum",
  },
};
