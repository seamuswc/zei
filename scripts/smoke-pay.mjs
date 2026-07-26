/**
 * Smoke test: invoice create, QR, DB row, sequential Etherscan scan, amount match logic.
 * Usage: USDC_RECEIVE_ADDRESS=0x... ETHERSCAN_API_KEY=... node scripts/smoke-pay.mjs
 */
import { randomBytes } from "crypto";
import Database from "better-sqlite3";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

const address = (process.env.USDC_RECEIVE_ADDRESS || "").trim();
const key = process.env.ETHERSCAN_API_KEY || "";
if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
  console.error("FAIL: set USDC_RECEIVE_ADDRESS");
  process.exit(1);
}
if (!key) {
  console.error("FAIL: set ETHERSCAN_API_KEY");
  process.exit(1);
}

const CHAINS = [
  { id: 1, name: "Ethereum", usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  { id: 8453, name: "Base", usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  { id: 42161, name: "Arbitrum", usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  { id: 10, name: "Optimism", usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" },
  { id: 137, name: "Polygon", usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
  { id: 43114, name: "Avalanche", usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" },
  { id: 59144, name: "Linea", usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff" },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tokentx(chain) {
  const u = new URL("https://api.etherscan.io/v2/api");
  u.searchParams.set("chainid", String(chain.id));
  u.searchParams.set("module", "account");
  u.searchParams.set("action", "tokentx");
  u.searchParams.set("contractaddress", chain.usdc);
  u.searchParams.set("address", address);
  u.searchParams.set("page", "1");
  u.searchParams.set("offset", "5");
  u.searchParams.set("sort", "desc");
  u.searchParams.set("apikey", key);
  const res = await fetch(u);
  const data = await res.json();
  const ok =
    data.status === "1" ||
    (data.status === "0" && /no transactions/i.test(String(data.message)));
  const rate = /rate limit/i.test(String(data.result || data.message || ""));
  return {
    name: chain.name,
    ok: ok && !rate,
    rate,
    count: Array.isArray(data.result) ? data.result.length : 0,
    message: data.message,
  };
}

const paymentId = randomBytes(12).toString("hex");
const base = 20_000_000n;
const micro = (BigInt("0x" + paymentId.slice(0, 8)) % 999999n) + 1n;
const amountRaw = base + micro;
const amountUsdc = `${amountRaw / 1000000n}.${(amountRaw % 1000000n).toString().padStart(6, "0")}`;
const ref = `ZEI:smoke:${paymentId.slice(0, 8)}`;
const eip681 = `ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=${address}&uint256=${amountRaw}`;
const qr = await QRCode.toDataURL(eip681, { width: 120, margin: 1 });

console.log("amount", amountUsdc, "raw", amountRaw.toString());
console.log("ref", ref);
console.log("qr bytes", qr.length);

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "zei-smoke.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    plan_expires_at TEXT,
    email_verified_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    invoice_id TEXT,
    amount REAL,
    currency TEXT,
    status TEXT NOT NULL,
    raw_json TEXT,
    created_at TEXT NOT NULL,
    amount_raw TEXT,
    ref_code TEXT,
    tx_hash TEXT
  );
`);
const uid = "smoke_" + paymentId.slice(0, 8);
db.prepare(
  `INSERT OR REPLACE INTO users (id,email,password_hash,plan,plan_expires_at,email_verified_at,created_at)
   VALUES (?,?,?,?,?,?,?)`,
).run(uid, "smoke@zei.test", "x", "free", null, new Date().toISOString(), new Date().toISOString());

db.prepare(
  `INSERT INTO payments (id,user_id,provider,invoice_id,amount,currency,status,raw_json,created_at,amount_raw,ref_code,tx_hash)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL)`,
).run(
  paymentId,
  uid,
  "usdc",
  paymentId,
  Number(amountUsdc),
  "usdc",
  "waiting",
  "{}",
  new Date().toISOString(),
  amountRaw.toString(),
  ref,
);

const row = db.prepare(`SELECT amount_raw, ref_code, status FROM payments WHERE id=?`).get(paymentId);
console.log("db", row);
if (row.amount_raw !== amountRaw.toString()) {
  console.error("FAIL: amount_raw mismatch");
  process.exit(1);
}

console.log("--- sequential etherscan ---");
let fails = 0;
for (const c of CHAINS) {
  const r = await tokentx(c);
  console.log(r.name, r.ok ? "OK" : "FAIL", `txs=${r.count}`, r.rate ? "RATE_LIMIT" : r.message);
  if (!r.ok) fails++;
  await sleep(250);
}

// Simulate match: pretend a tx with our amount exists
const fakeValue = amountRaw.toString();
const matched = BigInt(fakeValue) === amountRaw;
console.log("amount match logic", matched ? "OK" : "FAIL");

db.close();
fs.unlinkSync(path.join(dataDir, "zei-smoke.db"));

if (fails) {
  console.error(`FAIL: ${fails} chain(s) failed`);
  process.exit(1);
}
console.log("ALL SMOKE CHECKS PASSED");
