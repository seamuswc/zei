/**
 * Etherscan API V2 mainnets (https://api.etherscan.io/v2/chainlist).
 * Testnets omitted — tax import is mainnet-only.
 * Scroll / zkSync Era / Polygon zkEVM are not on the current V2 chainlist.
 *
 * Default wallet sync = `popular` majors only (~8). Full list is opt-in.
 */

export type EtherscanChain = {
  id: number;
  name: string;
  /** Native gas token ticker (uppercase). */
  nativeSymbol: string;
  /** CoinGecko id for native token JPY history (null = unpriced). */
  coinId: string | null;
  /** Default wallet sync set (ETH + major L2s / hubs). */
  popular?: boolean;
};

/** Prefix tx hash / dedupe keys so the same hash shape stays unique across chains. */
export function chainScopedKey(chainId: number, hash: string): string {
  return `${chainId}:${hash.toLowerCase()}`;
}

export const ETHERSCAN_CHAINS: EtherscanChain[] = [
  {
    id: 1,
    name: "Ethereum",
    nativeSymbol: "ETH",
    coinId: "ethereum",
    popular: true,
  },
  {
    id: 137,
    name: "Polygon",
    nativeSymbol: "POL",
    coinId: "polygon-ecosystem-token",
    popular: true,
  },
  {
    id: 42161,
    name: "Arbitrum One",
    nativeSymbol: "ETH",
    coinId: "ethereum",
    popular: true,
  },
  {
    id: 10,
    name: "Optimism",
    nativeSymbol: "ETH",
    coinId: "ethereum",
    popular: true,
  },
  {
    id: 8453,
    name: "Base",
    nativeSymbol: "ETH",
    coinId: "ethereum",
    popular: true,
  },
  {
    id: 56,
    name: "BNB Smart Chain",
    nativeSymbol: "BNB",
    coinId: "binancecoin",
    popular: true,
  },
  {
    id: 43114,
    name: "Avalanche C-Chain",
    nativeSymbol: "AVAX",
    coinId: "avalanche-2",
    popular: true,
  },
  {
    id: 59144,
    name: "Linea",
    nativeSymbol: "ETH",
    coinId: "ethereum",
    popular: true,
  },
  // —— More (still V2 mainnets; not in default sync) ——
  {
    id: 81457,
    name: "Blast",
    nativeSymbol: "ETH",
    coinId: "ethereum",
  },
  {
    id: 5000,
    name: "Mantle",
    nativeSymbol: "MNT",
    coinId: "mantle",
  },
  {
    id: 204,
    name: "opBNB",
    nativeSymbol: "BNB",
    coinId: "binancecoin",
  },
  {
    id: 167000,
    name: "Taiko",
    nativeSymbol: "ETH",
    coinId: "ethereum",
  },
  {
    id: 252,
    name: "Fraxtal",
    nativeSymbol: "frxETH",
    coinId: "frax-ether",
  },
  {
    id: 100,
    name: "Gnosis",
    nativeSymbol: "xDAI",
    coinId: "xdai",
  },
  {
    id: 42220,
    name: "Celo",
    nativeSymbol: "CELO",
    coinId: "celo",
  },
  {
    id: 1284,
    name: "Moonbeam",
    nativeSymbol: "GLMR",
    coinId: "moonbeam",
  },
  {
    id: 1285,
    name: "Moonriver",
    nativeSymbol: "MOVR",
    coinId: "moonriver",
  },
  {
    id: 480,
    name: "World",
    nativeSymbol: "ETH",
    coinId: "ethereum",
  },
  {
    id: 130,
    name: "Unichain",
    nativeSymbol: "ETH",
    coinId: "ethereum",
  },
  {
    id: 146,
    name: "Sonic",
    nativeSymbol: "S",
    coinId: "sonic-3",
  },
  {
    id: 80094,
    name: "Berachain",
    nativeSymbol: "BERA",
    coinId: "berachain-bera",
  },
  {
    id: 2741,
    name: "Abstract",
    nativeSymbol: "ETH",
    coinId: "ethereum",
  },
  {
    id: 143,
    name: "Monad",
    nativeSymbol: "MON",
    coinId: "monad",
  },
  {
    id: 999,
    name: "HyperEVM",
    nativeSymbol: "HYPE",
    coinId: "hyperliquid",
  },
  {
    id: 1329,
    name: "Sei",
    nativeSymbol: "SEI",
    coinId: "sei-network",
  },
  {
    id: 33139,
    name: "ApeChain",
    nativeSymbol: "APE",
    coinId: "apecoin",
  },
  {
    id: 50,
    name: "XDC",
    nativeSymbol: "XDC",
    coinId: "xdce-crowd-sale",
  },
  {
    id: 199,
    name: "BitTorrent Chain",
    nativeSymbol: "BTT",
    coinId: "bittorrent",
  },
  {
    id: 747474,
    name: "Katana",
    nativeSymbol: "ETH",
    coinId: "ethereum",
  },
  {
    id: 4352,
    name: "Memecore",
    nativeSymbol: "M",
    coinId: null,
  },
  {
    id: 9745,
    name: "Plasma",
    nativeSymbol: "XPL",
    coinId: null,
  },
  {
    id: 4326,
    name: "MegaETH",
    nativeSymbol: "ETH",
    coinId: "ethereum",
  },
  {
    id: 988,
    name: "Stable",
    nativeSymbol: "USN",
    coinId: null,
  },
];

const BY_ID = new Map(ETHERSCAN_CHAINS.map((c) => [c.id, c]));

export function getEtherscanChain(id: number): EtherscanChain | undefined {
  return BY_ID.get(id);
}

export function popularEtherscanChains(): EtherscanChain[] {
  return ETHERSCAN_CHAINS.filter((c) => c.popular);
}

export function moreEtherscanChains(): EtherscanChain[] {
  return ETHERSCAN_CHAINS.filter((c) => !c.popular);
}

export function allEtherscanChainIds(): number[] {
  return ETHERSCAN_CHAINS.map((c) => c.id);
}

/**
 * Default sync target: Ethereum + major L2s / EVM hubs with real users.
 * Full Etherscan V2 list is opt-in via `allChains` / advanced UI.
 */
export function defaultWalletChainIds(): number[] {
  return popularEtherscanChains().map((c) => c.id);
}

/**
 * Normalize client/API chain selection.
 * Empty / missing → major defaults (not all 33). Unknown ids dropped.
 */
export function resolveWalletChainIds(input?: number[] | null): number[] {
  if (!input || input.length === 0) return defaultWalletChainIds();
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of input) {
    const id = Number(raw);
    if (!Number.isFinite(id) || !BY_ID.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length ? out : defaultWalletChainIds();
}

function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export function chainLabelForIds(ids: number[]): string {
  if (ids.length === 0) return "—";
  if (ids.length === ETHERSCAN_CHAINS.length) {
    return `All Etherscan chains (${ids.length})`;
  }
  if (sameIdSet(ids, defaultWalletChainIds())) {
    return `ETH + major L2s (${ids.length})`;
  }
  const names = ids
    .map((id) => BY_ID.get(id)?.name ?? `chain ${id}`)
    .slice(0, 6);
  const extra = ids.length - names.length;
  return extra > 0
    ? `${names.join(", ")} +${extra}`
    : names.join(", ");
}
