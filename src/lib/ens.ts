/**
 * Lightweight ENS forward resolution (name → address) via Ethereum JSON-RPC.
 * No ethers/viem — namehash + eth_call against the mainnet registry/resolver.
 */

import {
  isEnsName,
  isEthHexAddress,
  normalizeWalletInput,
} from "@/lib/ens-format";

export {
  isEnsName,
  isEthHexAddress,
  normalizeWalletInput,
} from "@/lib/ens-format";

const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
/** resolver(bytes32) */
const SELECTOR_RESOLVER = "0178b8bf";
/** addr(bytes32) */
const SELECTOR_ADDR = "3b3b57de";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const ETH_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

const DEFAULT_RPC = "https://ethereum.publicnode.com";

export type EnsErrorCode =
  | "invalid_ens"
  | "not_found"
  | "resolve_failed";

export class EnsResolveError extends Error {
  readonly code: EnsErrorCode;
  constructor(code: EnsErrorCode, message: string) {
    super(message);
    this.name = "EnsResolveError";
    this.code = code;
  }
}

export function ethRpcUrl(): string {
  const fromEnv = (process.env.ETH_RPC_URL || "").trim();
  return fromEnv || DEFAULT_RPC;
}

// --- keccak256 / namehash (Ethereum; not NIST SHA-3) ---

const KECCAK_RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
  0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
  0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
  0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
  0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

const KECCAK_ROTC: number[][] = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

function rotl64(x: bigint, n: number): bigint {
  return ((x << BigInt(n)) | (x >> (64n - BigInt(n)))) & 0xffffffffffffffffn;
}

export function keccak256(data: Uint8Array): Uint8Array {
  const st = Array.from({ length: 25 }, () => 0n);
  const rate = 136;
  const padded = new Uint8Array(
    data.length + 1 + ((rate - ((data.length + 1) % rate)) % rate || rate),
  );
  padded.set(data);
  padded[data.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  for (let i = 0; i < padded.length; i += rate) {
    for (let j = 0; j < rate; j += 8) {
      let v = 0n;
      for (let k = 0; k < 8; k++) {
        v |= BigInt(padded[i + j + k]) << (BigInt(k) * 8n);
      }
      st[j / 8] ^= v;
    }
    for (let round = 0; round < 24; round++) {
      const C = Array<bigint>(5);
      const D = Array<bigint>(5);
      for (let x = 0; x < 5; x++) {
        C[x] = st[x] ^ st[x + 5] ^ st[x + 10] ^ st[x + 15] ^ st[x + 20];
      }
      for (let x = 0; x < 5; x++) {
        D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1);
        for (let y = 0; y < 5; y++) st[x + 5 * y] ^= D[x];
      }
      const B = Array<bigint>(25);
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(
            st[x + 5 * y],
            KECCAK_ROTC[x][y],
          );
        }
      }
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          const idx = x + 5 * y;
          st[idx] =
            B[idx] ^ (~B[((x + 1) % 5) + 5 * y] & B[((x + 2) % 5) + 5 * y]);
        }
      }
      st[0] ^= KECCAK_RC[round];
    }
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    let v = st[i];
    for (let k = 0; k < 8; k++) {
      out[i * 8 + k] = Number(v & 0xffn);
      v >>= 8n;
    }
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function labelhash(label: string): Uint8Array {
  return keccak256(new TextEncoder().encode(label));
}

/** ENS namehash (UTS-46 / emoji normalization not applied — ASCII .eth only). */
export function namehash(name: string): `0x${string}` {
  let node: Uint8Array = new Uint8Array(32);
  const normalized = name.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  if (!normalized) return `0x${bytesToHex(node)}`;
  const labels = normalized.split(".");
  for (let i = labels.length - 1; i >= 0; i--) {
    const lh = labelhash(labels[i]);
    const cat = new Uint8Array(64);
    cat.set(node, 0);
    cat.set(lh, 32);
    node = keccak256(cat);
  }
  return `0x${bytesToHex(node)}`;
}

async function ethCall(
  to: string,
  data: string,
  rpcUrl: string,
): Promise<string> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new EnsResolveError(
      "resolve_failed",
      `ENS RPC HTTP ${res.status}`,
    );
  }
  const json = (await res.json()) as {
    result?: string;
    error?: { message?: string };
  };
  if (json.error || typeof json.result !== "string") {
    throw new EnsResolveError(
      "resolve_failed",
      json.error?.message || "ENS RPC call failed",
    );
  }
  return json.result;
}

function decodeAddress(abiWord: string): string | null {
  const hex = abiWord.startsWith("0x") ? abiWord.slice(2) : abiWord;
  if (hex.length < 40) return null;
  const addr = `0x${hex.slice(-40).toLowerCase()}`;
  if (addr === ZERO_ADDR) return null;
  if (!ETH_ADDR_RE.test(addr)) return null;
  return addr;
}

/**
 * Resolve a validated `.eth` name to a checksum-agnostic lowercase 0x address.
 */
export async function resolveEnsName(
  ensName: string,
  rpcUrl: string = ethRpcUrl(),
): Promise<string> {
  const name = ensName.trim().toLowerCase();
  if (!isEnsName(name)) {
    throw new EnsResolveError("invalid_ens", "Invalid ENS name");
  }

  const node = namehash(name);
  const nodeNo0x = node.slice(2);

  try {
    const resolverRaw = await ethCall(
      ENS_REGISTRY,
      `0x${SELECTOR_RESOLVER}${nodeNo0x}`,
      rpcUrl,
    );
    const resolver = decodeAddress(resolverRaw);
    if (!resolver) {
      throw new EnsResolveError("not_found", "ENS name not found");
    }

    const addrRaw = await ethCall(
      resolver,
      `0x${SELECTOR_ADDR}${nodeNo0x}`,
      rpcUrl,
    );
    const address = decodeAddress(addrRaw);
    if (!address) {
      throw new EnsResolveError("not_found", "ENS name has no address");
    }
    return address;
  } catch (e) {
    if (e instanceof EnsResolveError) throw e;
    throw new EnsResolveError(
      "resolve_failed",
      e instanceof Error ? e.message : "ENS resolve failed",
    );
  }
}

export type ResolvedWallet = {
  /** Canonical address used for sync / storage (lowercase for ETH). */
  address: string;
  /** Present when the user provided an ENS name. */
  ens?: string;
};

/**
 * Accept `0x…` or `name.eth`. Other non-ENS inputs pass through after trim
 * (caller still validates chain).
 */
export async function resolveWalletAddress(
  raw: string,
  rpcUrl: string = ethRpcUrl(),
): Promise<ResolvedWallet> {
  const input = normalizeWalletInput(raw);
  if (!input) {
    throw new EnsResolveError("invalid_ens", "Empty address");
  }

  if (isEthHexAddress(input)) {
    return { address: input.toLowerCase() };
  }

  if (input.includes(".") || input.toLowerCase().endsWith(".eth")) {
    if (!isEnsName(input)) {
      throw new EnsResolveError("invalid_ens", "Invalid ENS name");
    }
    const address = await resolveEnsName(input, rpcUrl);
    return { address, ens: input };
  }

  // Unknown format — leave to detectChain
  return { address: input };
}
