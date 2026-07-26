import { getDb } from "@/lib/db";
import { unlockPro } from "@/lib/auth";
import { randomBytes } from "crypto";

/** Pro price in USDC (human units). Matched with sender wallet + this clean amount. */
export const PRO_USDC = Number(process.env.ZEI_PRO_PRICE_USDC || 20);

/** Allow tiny rounding drift vs exact Pro price (0.01 USDC). */
const AMOUNT_TOLERANCE_RAW = 10_000n;

export type PayChain = {
  id: number;
  name: string;
  usdc: string;
};

/**
 * Official Circle USDC on chains supported by Etherscan API V2 (free tier).
 * Scroll removed — V2 no longer supports chainid 534352.
 */
export const USDC_CHAINS: PayChain[] = [
  {
    id: 1,
    name: "Ethereum",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  {
    id: 8453,
    name: "Base",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  {
    id: 42161,
    name: "Arbitrum",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  },
  {
    id: 10,
    name: "Optimism",
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  },
  {
    id: 137,
    name: "Polygon",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  },
  {
    id: 43114,
    name: "Avalanche",
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  },
  {
    id: 59144,
    name: "Linea",
    usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
  },
];

export type UsdcInvoice = {
  paymentId: string;
  provider: "usdc";
  address: string;
  amountUsdc: string;
  amountRaw: string;
  fromAddress: string | null;
  chains: Array<{ id: number; name: string; usdc: string }>;
  allowDevConfirm: boolean;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function receiveAddress(): string {
  const addr = (process.env.USDC_RECEIVE_ADDRESS || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error(
      "USDC_RECEIVE_ADDRESS missing or invalid. Set your ETH/L2 receive wallet in env.",
    );
  }
  return addr;
}

function proAmountRaw(): bigint {
  return BigInt(Math.round(PRO_USDC * 1_000_000));
}

/** Human display without unique micros — e.g. "20" or "19.5". */
export function formatProUsdc(): string {
  const n = PRO_USDC;
  if (!Number.isFinite(n) || n <= 0) return "20";
  return Number.isInteger(n) ? String(n) : String(n);
}

function normalizeAddress(addr: string): string {
  const a = addr.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(a)) {
    throw new Error("Invalid wallet address");
  }
  return a;
}

function amountClose(value: bigint, want: bigint): boolean {
  const diff = value > want ? value - want : want - value;
  return diff <= AMOUNT_TOLERANCE_RAW;
}

export async function createUsdcInvoice(options: {
  userId: string;
  /** Kept for API compatibility with callers. */
  email?: string;
  fromAddress?: string;
}): Promise<UsdcInvoice> {
  const address = receiveAddress();
  const paymentId = randomBytes(12).toString("hex");
  const amountRaw = proAmountRaw();
  const amountUsdc = formatProUsdc();
  const fromAddress = options.fromAddress
    ? normalizeAddress(options.fromAddress)
    : null;

  const db = getDb();
  db.prepare(
    `INSERT INTO payments (
      id, user_id, provider, invoice_id, amount, currency, status, raw_json, created_at,
      amount_raw, ref_code, tx_hash, from_address
    ) VALUES (?, ?, 'usdc', ?, ?, 'usdc', 'waiting', ?, ?, ?, NULL, NULL, ?)`,
  ).run(
    paymentId,
    options.userId,
    paymentId,
    Number(amountUsdc),
    JSON.stringify({ address, match: "from+amount" }),
    new Date().toISOString(),
    amountRaw.toString(),
    fromAddress,
  );

  return {
    paymentId,
    provider: "usdc",
    address,
    amountUsdc,
    amountRaw: amountRaw.toString(),
    fromAddress,
    chains: USDC_CHAINS.map((c) => ({
      id: c.id,
      name: c.name,
      usdc: c.usdc,
    })),
    allowDevConfirm: process.env.ALLOW_DEV_PAY === "1",
  };
}

/** Bind the connected payer wallet to a waiting invoice (logged-in owner only). */
export function bindPaymentFromAddress(options: {
  paymentId: string;
  userId: string;
  fromAddress: string;
}): { ok: true; fromAddress: string } {
  const fromAddress = normalizeAddress(options.fromAddress);
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, user_id, status FROM payments WHERE id = ?`,
    )
    .get(options.paymentId) as
    | { id: string; user_id: string; status: string }
    | undefined;

  if (!row || row.user_id !== options.userId) {
    throw new Error("Payment not found");
  }
  if (row.status !== "waiting") {
    throw new Error("Payment is no longer waiting");
  }

  db.prepare(
    `UPDATE payments SET from_address = ? WHERE id = ? AND user_id = ? AND status = 'waiting'`,
  ).run(fromAddress, options.paymentId, options.userId);

  return { ok: true, fromAddress };
}

type TokenTx = {
  hash: string;
  to: string;
  from: string;
  value: string;
  timeStamp: string;
  contractAddress: string;
};

async function fetchUsdcIncoming(
  chain: PayChain,
  address: string,
  attempt = 0,
): Promise<TokenTx[]> {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) {
    throw new Error("ETHERSCAN_API_KEY required to verify USDC payments.");
  }

  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", String(chain.id));
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "tokentx");
  url.searchParams.set("contractaddress", chain.usdc);
  url.searchParams.set("address", address);
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", "100");
  url.searchParams.set("sort", "desc");
  url.searchParams.set("apikey", key);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Etherscan ${chain.name}: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    status?: string;
    message?: string;
    result?: TokenTx[] | string;
  };

  const resultStr =
    typeof data.result === "string" ? data.result : data.message || "";
  if (/rate limit/i.test(resultStr) || /rate limit/i.test(data.message || "")) {
    if (attempt < 3) {
      await sleep(600 * (attempt + 1));
      return fetchUsdcIncoming(chain, address, attempt + 1);
    }
    throw new Error(`Etherscan rate limit on ${chain.name}. Try again shortly.`);
  }

  if (!Array.isArray(data.result)) {
    if (data.status === "0" && /no transactions/i.test(String(data.message))) {
      return [];
    }
    if (data.status === "0" && data.message === "NOTOK") {
      return [];
    }
    return [];
  }

  const addr = address.toLowerCase();
  const usdc = chain.usdc.toLowerCase();
  return data.result.filter(
    (tx) =>
      (tx.to || "").toLowerCase() === addr &&
      (tx.contractAddress || "").toLowerCase() === usdc,
  );
}

function claimedTxHashes(): Set<string> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT tx_hash FROM payments WHERE tx_hash IS NOT NULL AND tx_hash != ''`,
    )
    .all() as Array<{ tx_hash: string }>;
  return new Set(rows.map((r) => r.tx_hash.toLowerCase()));
}

function markFinished(options: {
  paymentId: string;
  userId: string;
  txHash: string;
  chainName: string;
  chainId?: number;
  from?: string;
  value?: string;
}) {
  const db = getDb();
  db.prepare(
    `UPDATE payments
     SET status = 'finished', tx_hash = ?, raw_json = ?
     WHERE id = ?`,
  ).run(
    options.txHash,
    JSON.stringify({
      chainId: options.chainId,
      chain: options.chainName,
      from: options.from,
      hash: options.txHash,
      value: options.value,
    }),
    options.paymentId,
  );
  unlockPro(options.userId, 365);
}

/** Scan ETH + L2s sequentially (free Etherscan = 5 req/s). Match from + amount. */
export async function verifyUsdcPayment(options: {
  paymentId: string;
  userId: string;
  preferChainId?: number;
}): Promise<
  | { ok: true; txHash: string; chain: string }
  | { ok: false; status: "waiting" | "missing"; message: string }
> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, user_id, status, amount_raw, from_address, created_at, tx_hash
       FROM payments WHERE id = ?`,
    )
    .get(options.paymentId) as
    | {
        id: string;
        user_id: string;
        status: string;
        amount_raw: string | null;
        from_address: string | null;
        created_at: string;
        tx_hash: string | null;
      }
    | undefined;

  if (!row || row.user_id !== options.userId) {
    return { ok: false, status: "missing", message: "Payment not found." };
  }
  if (row.status === "finished" || row.tx_hash) {
    unlockPro(row.user_id, 365);
    return {
      ok: true,
      txHash: row.tx_hash || "already",
      chain: "recorded",
    };
  }
  if (!row.amount_raw) {
    return {
      ok: false,
      status: "missing",
      message: "Payment has no amount — create a new invoice.",
    };
  }
  if (!row.from_address) {
    return {
      ok: false,
      status: "waiting",
      message: "Connect your wallet before we can match the payment.",
    };
  }

  const address = receiveAddress();
  const want = BigInt(row.amount_raw);
  const fromWant = row.from_address.toLowerCase();
  const createdUnix =
    Math.floor(new Date(row.created_at).getTime() / 1000) - 600;
  const used = claimedTxHashes();
  const errors: string[] = [];

  const chains = [...USDC_CHAINS];
  if (options.preferChainId) {
    chains.sort((a, b) => {
      if (a.id === options.preferChainId) return -1;
      if (b.id === options.preferChainId) return 1;
      return 0;
    });
  }

  for (const chain of chains) {
    try {
      const txs = await fetchUsdcIncoming(chain, address);
      for (const tx of txs) {
        let value: bigint;
        try {
          value = BigInt(tx.value);
        } catch {
          continue;
        }
        if ((tx.from || "").toLowerCase() !== fromWant) continue;
        if (!amountClose(value, want)) continue;
        if (Number(tx.timeStamp) < createdUnix) continue;
        if (used.has(tx.hash.toLowerCase())) continue;

        markFinished({
          paymentId: row.id,
          userId: row.user_id,
          txHash: tx.hash,
          chainName: chain.name,
          chainId: chain.id,
          from: tx.from,
          value: tx.value,
        });
        return { ok: true, txHash: tx.hash, chain: chain.name };
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
    await sleep(250);
  }

  if (errors.length >= chains.length) {
    return {
      ok: false,
      status: "waiting",
      message: errors[0] || "Could not reach Etherscan. Try again.",
    };
  }

  return {
    ok: false,
    status: "waiting",
    message:
      "USDC not seen yet. After your wallet confirms the transfer, wait ~1 min, then check again.",
  };
}

/** Local-only unlock without on-chain payment. */
export function confirmDevPayment(options: {
  paymentId: string;
  userId: string;
}): { ok: true; txHash: string; chain: string } {
  if (process.env.ALLOW_DEV_PAY !== "1") {
    throw new Error("Dev pay disabled");
  }
  const db = getDb();
  const row = db
    .prepare(`SELECT id, user_id, status FROM payments WHERE id = ?`)
    .get(options.paymentId) as
    | { id: string; user_id: string; status: string }
    | undefined;
  if (!row || row.user_id !== options.userId) {
    throw new Error("Payment not found");
  }
  const txHash = `dev_${row.id}`;
  markFinished({
    paymentId: row.id,
    userId: row.user_id,
    txHash,
    chainName: "dev",
  });
  return { ok: true, txHash, chain: "dev" };
}

/** @deprecated alias */
export async function createCryptoInvoice(options: {
  userId: string;
  email: string;
}) {
  return createUsdcInvoice(options);
}
