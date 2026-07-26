import { getDb } from "@/lib/db";
import { unlockPro } from "@/lib/auth";
import { randomBytes } from "crypto";
import QRCode from "qrcode";

/** Pro price in USDC (human units). Exact on-chain amount adds a unique micro suffix for matching. */
export const PRO_USDC = Number(process.env.ZEI_PRO_PRICE_USDC || 20);

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
  ref: string;
  chains: Array<{ id: number; name: string }>;
  qrDataUrl: string;
  eip681: string;
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

function usernameFromEmail(email: string): string {
  const local = email.split("@")[0] || "user";
  return local.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 24) || "user";
}

function formatUsdc(raw: bigint): string {
  const whole = raw / 1_000_000n;
  const frac = (raw % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${frac}`;
}

function eip681Transfer(
  chain: PayChain,
  to: string,
  amountRaw: bigint,
): string {
  return `ethereum:${chain.usdc}@${chain.id}/transfer?address=${to}&uint256=${amountRaw}`;
}

/** Unique on-chain amount unused by any waiting payment. */
function allocateAmountRaw(paymentId: string): bigint {
  const db = getDb();
  const base = BigInt(Math.round(PRO_USDC * 1_000_000));
  const used = new Set(
    (
      db
        .prepare(
          `SELECT amount_raw FROM payments
           WHERE status = 'waiting' AND amount_raw IS NOT NULL`,
        )
        .all() as Array<{ amount_raw: string }>
    ).map((r) => r.amount_raw),
  );

  for (let i = 0; i < 50; i++) {
    const seed = paymentId + (i ? `:${i}` : "");
    const hex = Buffer.from(seed).toString("hex").slice(0, 8);
    const micro = (BigInt("0x" + hex) % 999999n) + 1n;
    const raw = base + micro;
    if (!used.has(raw.toString())) return raw;
  }
  // Fallback: time-based micro
  const raw = base + (BigInt(Date.now() % 999999) + 1n);
  return raw;
}

export async function createUsdcInvoice(options: {
  userId: string;
  email: string;
}): Promise<UsdcInvoice> {
  const address = receiveAddress();
  const paymentId = randomBytes(12).toString("hex");
  const amountRaw = allocateAmountRaw(paymentId);
  const amountUsdc = formatUsdc(amountRaw);
  const user = usernameFromEmail(options.email);
  const ref = `ZEI:${user}:${paymentId.slice(0, 8)}`;

  const qrChain =
    USDC_CHAINS.find((c) => c.id === 8453) ?? USDC_CHAINS[0];
  const eip681 = eip681Transfer(qrChain, address, amountRaw);

  // EIP-681 URI so wallets that support it prefill token, chain, destination, amount.
  const qrDataUrl = await QRCode.toDataURL(eip681, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
  });

  const db = getDb();
  db.prepare(
    `INSERT INTO payments (
      id, user_id, provider, invoice_id, amount, currency, status, raw_json, created_at,
      amount_raw, ref_code, tx_hash
    ) VALUES (?, ?, 'usdc', ?, ?, 'usdc', 'waiting', ?, ?, ?, ?, NULL)`,
  ).run(
    paymentId,
    options.userId,
    paymentId,
    Number(amountUsdc),
    JSON.stringify({ ref, eip681, qrChain: qrChain.id, address }),
    new Date().toISOString(),
    amountRaw.toString(),
    ref,
  );

  return {
    paymentId,
    provider: "usdc",
    address,
    amountUsdc,
    amountRaw: amountRaw.toString(),
    ref,
    chains: USDC_CHAINS.map((c) => ({ id: c.id, name: c.name })),
    qrDataUrl,
    eip681,
    allowDevConfirm: process.env.ALLOW_DEV_PAY === "1",
  };
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
      // Unsupported chain / soft error — skip
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
  ref?: string | null;
}) {
  const db = getDb();
  db.prepare(
    `UPDATE payments
     SET status = 'finished', tx_hash = ?, raw_json = ?
     WHERE id = ?`,
  ).run(
    options.txHash,
    JSON.stringify({
      ref: options.ref,
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

/** Scan ETH + L2s sequentially (free Etherscan = 5 req/s). */
export async function verifyUsdcPayment(options: {
  paymentId: string;
  userId: string;
}): Promise<
  | { ok: true; txHash: string; chain: string }
  | { ok: false; status: "waiting" | "missing"; message: string }
> {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, user_id, status, amount_raw, ref_code, created_at, tx_hash
       FROM payments WHERE id = ?`,
    )
    .get(options.paymentId) as
    | {
        id: string;
        user_id: string;
        status: string;
        amount_raw: string | null;
        ref_code: string | null;
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

  const address = receiveAddress();
  const want = BigInt(row.amount_raw);
  const createdUnix =
    Math.floor(new Date(row.created_at).getTime() / 1000) - 600;
  const used = claimedTxHashes();
  const errors: string[] = [];

  for (const chain of USDC_CHAINS) {
    try {
      const txs = await fetchUsdcIncoming(chain, address);
      for (const tx of txs) {
        let value: bigint;
        try {
          value = BigInt(tx.value);
        } catch {
          continue;
        }
        if (value !== want) continue;
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
          ref: row.ref_code,
        });
        return { ok: true, txHash: tx.hash, chain: chain.name };
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
    await sleep(250);
  }

  if (errors.length >= USDC_CHAINS.length) {
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
      "USDC not seen yet. Send the exact amount on ETH or any listed L2, wait ~1 min, then check again.",
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
    ref: null,
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
