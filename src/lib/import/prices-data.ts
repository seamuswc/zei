import {
  SYMBOL_TO_COINGECKO,
  coinIdForAsset,
  resolveCoinId,
} from "@/lib/import/token-aliases";

/** @deprecated Prefer SYMBOL_TO_COINGECKO / coinIdForAsset from token-aliases. */
export const COIN_IDS: Record<string, string> = SYMBOL_TO_COINGECKO;

export { coinIdForAsset, resolveCoinId };

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
  /** ETHLend / Aave [OLD] LEND */
  "0x80fb784b7ed66730e8b1dbd9820afd29931aab03": {
    symbol: "LEND",
    decimals: 18,
    coinId: "ethlend",
  },
  "0xb50721bdf60b66aa785914594174e9d9b2241ff2": {
    symbol: "ARB",
    decimals: 18,
    coinId: "arbitrum",
  },

  // Aave V1 aTokens (price via underlying CoinGecko id)
  "0x3a3a65aab0dd2a17e3f1947ba16138cd37d08c04": {
    symbol: "AETH",
    decimals: 18,
    coinId: "ethereum",
  },
  "0x7d2d3688df45ce7f552e15990f1ce42b1c1aad31": {
    symbol: "ALEND",
    decimals: 18,
    coinId: "ethlend",
  },
  "0xfc1e690f61efd961294b3e1ce9274610feed36a3": {
    symbol: "ADAI",
    decimals: 18,
    coinId: "dai",
  },
  "0x9ba00d6856a4edf4665bca2ca230bdc963528143": {
    symbol: "AUSDC",
    decimals: 6,
    coinId: "usd-coin",
  },
  "0x71fc860f7d3a592a4a98740e39db31d25db65ba0": {
    symbol: "AUSDT",
    decimals: 6,
    coinId: "tether",
  },
  "0xa64bd6c70cb9051f6a9e4cec87c915f0fdc5dc6e": {
    symbol: "ALINK",
    decimals: 18,
    coinId: "chainlink",
  },
  "0xfc4b8ed459e00e5400be803a9bb3954234fd50e3": {
    symbol: "AWBTC",
    decimals: 8,
    coinId: "wrapped-bitcoin",
  },

  // Aave V2 aTokens
  "0x030ba81f1c18d280636f32af80b9aad02cf0854e": {
    symbol: "AWETH",
    decimals: 18,
    coinId: "ethereum",
  },
  "0x028171bca77440897b824ca71d1c56cac55b68a3": {
    symbol: "ADAI",
    decimals: 18,
    coinId: "dai",
  },
  "0xbcca60bb61934080951369a648fb03df4f96263c": {
    symbol: "AUSDC",
    decimals: 6,
    coinId: "usd-coin",
  },
  "0x3ed3b47dd13ec9a98b44e6204a523e766b225fc5": {
    symbol: "AUSDT",
    decimals: 6,
    coinId: "tether",
  },
  "0xffc97d72e13e01096502cb8eb52dee56f74dad7b": {
    symbol: "AAAVE",
    decimals: 18,
    coinId: "aave",
  },
};
