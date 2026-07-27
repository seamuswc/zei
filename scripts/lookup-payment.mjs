#!/usr/bin/env node
/**
 * Ops: look up a user / payment by email or tx_hash (read-only).
 *
 * Usage (on droplet, from /var/www/zei):
 *   node scripts/lookup-payment.mjs user@example.com
 *   node scripts/lookup-payment.mjs 0xabc123...
 *
 * Env: ZEI_DB (optional, default data/zei.db)
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DB_PATH = process.env.ZEI_DB || path.join(ROOT, "data", "zei.db");

const q = (process.argv[2] || "").trim();
if (!q || q === "-h" || q === "--help") {
  console.log(`Usage: node scripts/lookup-payment.mjs <email-or-tx_hash>
DB: ${DB_PATH}`);
  process.exit(q ? 0 : 1);
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`DB not found: ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });
const looksLikeTx = /^0x[a-fA-F0-9]{64}$/.test(q) || /^dev_[a-fA-F0-9]+$/i.test(q);
const email = q.toLowerCase();

function printUser(u) {
  if (!u) {
    console.log("USER: (not found)");
    return;
  }
  console.log("USER:");
  console.log(`  id:               ${u.id}`);
  console.log(`  email:            ${u.email}`);
  console.log(`  plan:             ${u.plan}`);
  console.log(`  plan_expires_at:  ${u.plan_expires_at || "(null)"}`);
  console.log(`  email_verified_at:${u.email_verified_at || "(null)"}`);
  console.log(`  created_at:       ${u.created_at}`);
}

function printPayments(rows) {
  if (!rows.length) {
    console.log("PAYMENTS: (none)");
    return;
  }
  console.log(`PAYMENTS (${rows.length}):`);
  for (const p of rows) {
    console.log("---");
    console.log(`  payment_id:   ${p.id}`);
    console.log(`  user_id:      ${p.user_id}`);
    console.log(`  email:        ${p.email || "(n/a)"}`);
    console.log(`  status:       ${p.status}`);
    console.log(`  amount:       ${p.amount} ${p.currency || ""}`.trim());
    console.log(`  amount_raw:   ${p.amount_raw || "(null)"}`);
    console.log(`  from_address: ${p.from_address || "(null)"}`);
    console.log(`  tx_hash:      ${p.tx_hash || "(null)"}`);
    console.log(`  created_at:   ${p.created_at}`);
    if (p.raw_json) {
      try {
        const raw = JSON.parse(p.raw_json);
        if (raw.chain || raw.chainId || raw.hash) {
          console.log(
            `  chain:        ${raw.chain || "?"} (id=${raw.chainId ?? "?"})`,
          );
        }
      } catch {
        /* ignore */
      }
    }
  }
}

if (looksLikeTx) {
  const rows = db
    .prepare(
      `SELECT p.id, p.user_id, u.email, p.status, p.amount, p.currency,
              p.amount_raw, p.from_address, p.tx_hash, p.created_at, p.raw_json
       FROM payments p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE lower(p.tx_hash) = lower(?)`,
    )
    .all(q);

  if (!rows.length) {
    console.log(`No payment with tx_hash=${q}`);
    process.exit(0);
  }

  const user = db
    .prepare(
      `SELECT id, email, plan, plan_expires_at, email_verified_at, created_at
       FROM users WHERE id = ?`,
    )
    .get(rows[0].user_id);

  printUser(user);
  printPayments(rows);

  const match =
    user &&
    rows.some((r) => r.status === "finished" && r.tx_hash) &&
    user.plan === "pro";
  console.log("---");
  console.log(
    match
      ? "VERDICT: payment finished + user is pro — looks verified"
      : "VERDICT: check status/plan above — may still be waiting or plan not unlocked",
  );
} else {
  const user = db
    .prepare(
      `SELECT id, email, plan, plan_expires_at, email_verified_at, created_at
       FROM users WHERE email = ?`,
    )
    .get(email);

  printUser(user);
  if (!user) process.exit(0);

  const rows = db
    .prepare(
      `SELECT p.id, p.user_id, u.email, p.status, p.amount, p.currency,
              p.amount_raw, p.from_address, p.tx_hash, p.created_at, p.raw_json
       FROM payments p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`,
    )
    .all(user.id);

  printPayments(rows);
  console.log("---");
  const finished = rows.filter((r) => r.status === "finished");
  if (finished.length && user.plan === "pro") {
    console.log(
      `VERDICT: ${finished.length} finished payment(s), plan=pro — looks verified`,
    );
  } else if (finished.length && user.plan !== "pro") {
    console.log(
      "VERDICT: finished payment exists but plan is not pro — investigate unlock",
    );
  } else if (rows.some((r) => r.status === "waiting")) {
    console.log(
      "VERDICT: waiting invoice(s) only — no on-chain match recorded yet",
    );
  } else {
    console.log("VERDICT: no payments — user has not started checkout");
  }
}

db.close();
