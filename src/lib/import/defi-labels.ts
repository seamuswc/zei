/**
 * Best-effort Ethereum mainnet DeFi / distributor address map for wallet import.
 *
 * Not exhaustive. Supply↔borrow and withdraw↔borrow can collide without log decode;
 * Review remains the source of truth. Prefer expanding this map over pulling heavy ABI deps.
 *
 * Optional future: match Aave V3 topic0 on receipts for Borrow/Repay/Supply/Withdraw:
 *   Borrow(address,address,address,uint256,uint256,uint256,uint16)
 *   Repay(address,address,address,uint256,bool)
 *   Supply(address,address,address,uint256,uint16)
 *   Withdraw(address,address,address,uint256)
 */

export type DefiLabelKind =
  | "lending_pool"
  | "airdrop_distributor"
  | "wrap_token";

export interface DefiLabel {
  kind: DefiLabelKind;
  name: string;
  /** Human note fragment for ledger. */
  note: string;
}

/** Lowercase 0x addresses → label. */
export const ETH_MAINNET_DEFI_LABELS: Record<string, DefiLabel> = {
  // WETH9
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
    kind: "wrap_token",
    name: "WETH",
    note: "WETH",
  },

  // Aave V1 LendingPool (ETHLend era — LEND / aLEND)
  "0x398ec7346dcd622edc5ae82352f02be94c62d119": {
    kind: "lending_pool",
    name: "Aave V1 LendingPool",
    note: "Aave V1",
  },
  // Aave V2 LendingPool
  "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9": {
    kind: "lending_pool",
    name: "Aave V2 LendingPool",
    note: "Aave V2",
  },
  // Aave V3 Pool (Ethereum)
  "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2": {
    kind: "lending_pool",
    name: "Aave V3 Pool",
    note: "Aave V3",
  },
  // Aave V3 PoolAddressesProvider (rarely the token counterparty; kept for completeness)
  "0x2f39d218133afab373f149f7a9b0c33f19f005c5": {
    kind: "lending_pool",
    name: "Aave V3 Provider",
    note: "Aave V3",
  },

  // Compound V3 (Comet) — USDC / WETH markets
  "0xc3d688b66703497daa19211eedff47f25384cdc3": {
    kind: "lending_pool",
    name: "Compound V3 USDC",
    note: "Compound V3",
  },
  "0xa17581a9e3356d1a528b7b1e8a4268b588b77b8b": {
    kind: "lending_pool",
    name: "Compound V3 WETH",
    note: "Compound V3",
  },
  // Compound V2 cETH (legacy; token hops often look like transfers)
  "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5": {
    kind: "lending_pool",
    name: "Compound V2 cETH",
    note: "Compound V2",
  },

  // High-confidence airdrop / claim distributors (inbound-only → income)
  // Optimism airdrop #1 distributor
  "0xfedfaf1a10335448b4a5266dc1db21a8a971aad0": {
    kind: "airdrop_distributor",
    name: "Optimism airdrop",
    note: "Optimism airdrop",
  },
  // Arbitrum airdrop token distributor
  "0x67a24ce4321ab3af5156d4b8f2b4e76d80f0db9e": {
    kind: "airdrop_distributor",
    name: "Arbitrum airdrop",
    note: "Arbitrum airdrop",
  },
  // ENS token airdrop
  "0xc18360217d8f7ab5e7dc45f15058db0fbe6e3c6e": {
    kind: "airdrop_distributor",
    name: "ENS token",
    note: "ENS airdrop",
  },
  // Uniswap UNI merkle distributor (historical)
  "0x090d4613473dee047c3f2706764f04e5131672bd": {
    kind: "airdrop_distributor",
    name: "UNI merkle",
    note: "UNI airdrop",
  },
};

export function defiLabelFor(address: string | undefined | null): DefiLabel | null {
  if (!address) return null;
  return ETH_MAINNET_DEFI_LABELS[address.toLowerCase()] ?? null;
}

export function isLendingPool(address: string | undefined | null): boolean {
  return defiLabelFor(address)?.kind === "lending_pool";
}

export function isAirdropDistributor(address: string | undefined | null): boolean {
  return defiLabelFor(address)?.kind === "airdrop_distributor";
}
