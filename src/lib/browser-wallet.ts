/** Lightweight EIP-1193 helpers (MetaMask / injected wallets). No WalletConnect dep. */

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
};

export type PayChainClient = {
  id: number;
  name: string;
  usdc: string;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export function getInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

export function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function isHexAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

/** ERC-20 transfer(address,uint256) calldata */
export function encodeUsdcTransfer(to: string, amountRaw: bigint): string {
  if (!isHexAddress(to)) throw new Error("Invalid receive address");
  const selector = "a9059cbb";
  const toPad = to.slice(2).toLowerCase().padStart(64, "0");
  const amtPad = amountRaw.toString(16).padStart(64, "0");
  return `0x${selector}${toPad}${amtPad}`;
}

function toHexChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

/** Public RPCs only used for wallet_addEthereumChain hints. */
const CHAIN_ADD: Record<
  number,
  {
    chainName: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    rpcUrls: string[];
    blockExplorerUrls: string[];
  }
> = {
  1: {
    chainName: "Ethereum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://ethereum.publicnode.com"],
    blockExplorerUrls: ["https://etherscan.io"],
  },
  8453: {
    chainName: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://mainnet.base.org"],
    blockExplorerUrls: ["https://basescan.org"],
  },
  42161: {
    chainName: "Arbitrum One",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    blockExplorerUrls: ["https://arbiscan.io"],
  },
  10: {
    chainName: "Optimism",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://mainnet.optimism.io"],
    blockExplorerUrls: ["https://optimistic.etherscan.io"],
  },
  137: {
    chainName: "Polygon",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: ["https://polygon-rpc.com"],
    blockExplorerUrls: ["https://polygonscan.com"],
  },
  43114: {
    chainName: "Avalanche C-Chain",
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    rpcUrls: ["https://api.avax.network/ext/bc/C/rpc"],
    blockExplorerUrls: ["https://snowtrace.io"],
  },
  59144: {
    chainName: "Linea",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.linea.build"],
    blockExplorerUrls: ["https://lineascan.build"],
  },
};

export async function connectWallet(): Promise<string> {
  const eth = getInjectedProvider();
  if (!eth) throw new Error("NO_WALLET");
  const accounts = (await eth.request({
    method: "eth_requestAccounts",
  })) as string[];
  const addr = (accounts[0] || "").toLowerCase();
  if (!isHexAddress(addr)) throw new Error("NO_ACCOUNT");
  return addr;
}

export async function getChainId(eth: Eip1193Provider): Promise<number> {
  const hex = (await eth.request({ method: "eth_chainId" })) as string;
  return Number.parseInt(hex, 16);
}

export async function ensureChain(
  eth: Eip1193Provider,
  chainId: number,
): Promise<void> {
  const current = await getChainId(eth);
  if (current === chainId) return;
  const hex = toHexChainId(chainId);
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hex }],
    });
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? Number((e as { code: number }).code)
        : 0;
    const meta = CHAIN_ADD[chainId];
    if ((code === 4902 || code === -32603) && meta) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hex,
            chainName: meta.chainName,
            nativeCurrency: meta.nativeCurrency,
            rpcUrls: meta.rpcUrls,
            blockExplorerUrls: meta.blockExplorerUrls,
          },
        ],
      });
      return;
    }
    throw e;
  }
}

export async function sendUsdcTransfer(options: {
  from: string;
  to: string;
  usdc: string;
  amountRaw: bigint;
  chainId: number;
}): Promise<string> {
  const eth = getInjectedProvider();
  if (!eth) throw new Error("NO_WALLET");
  await ensureChain(eth, options.chainId);
  const data = encodeUsdcTransfer(options.to, options.amountRaw);
  const txHash = (await eth.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: options.from,
        to: options.usdc,
        data,
        value: "0x0",
      },
    ],
  })) as string;
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error("BAD_TX");
  }
  return txHash;
}
