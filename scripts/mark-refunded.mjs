#!/usr/bin/env node
/**
 * Ops: mark a Pro payment as refunded (sets refunded_at once; refuses double-mark).
 *
 * Usage (on droplet, from /var/www/zei):
 *   node scripts/mark-refunded.mjs <paymentId|txHash|email>
 *   node scripts/mark-refunded.mjs <id> --note "chargeback 2026-07-27"
 *
 * If email matches multiple finished (non-refunded) payments, refuses — use payment id.
 * When clean (this is the user's only active finished payment and plan=pro),
 * sets plan back to free.
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

const args = process.argv.slice(2);
let note = null;
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--note") {
    note = args[++i] || "";
    continue;
  }
  if (args[i] === "-h" || args[i] === "--help") {
    console.log(`Usage: node scripts/mark-refunded.mjs <paymentId|txHash|email> [--note "..."]
DB: ${DB_PATH}`);
    process.exit(0);
  }
  positional.push(args[i]);
}

const q = (positional[0] || "").trim();
if (!q) {
  console.error(`Usage: node scripts/mark-refunded.mjs <paymentId|txHash|email> [--note "..."]
DB: ${DB_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`DB not found: ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH);
const payCols = new Set(
  db.prepare(`PRAGMA table_info(payments)`).all().map((c) => c.name),
);
if (!payCols.has("refunded_at")) {
  db.exec(`ALTER TABLE payments ADD COLUMN refunded_at TEXT`);
}
if (!payCols.has("refund_note")) {
  db.exec(`ALTER TABLE payments ADD COLUMN refund_note TEXT`);
}
const looksLikeTx = /^0x[a-fA-F0-9]{64}$/.test(q) || /^dev_[a-fA-F0-9]+$/i.test(q);
const looksLikeEmail = q.includes("@");

const SELECT = `SELECT p.id, p.user_id, p.status, p.tx_hash, p.refunded_at, p.refund_note,
                       u.email, u.plan
                FROM payments p
                LEFT JOIN users u ON u.id = p.user_id`;

let row;
if (looksLikeTx) {
  const rows = db
    .prepare(`${SELECT} WHERE lower(p.tx_hash) = lower(?)`)
    .all(q);
  if (!rows.length) {
    console.error(`No payment with tx_hash=${q}`);
    process.exit(1);
  }
  if (rows.length > 1) {
    console.error(
      `Multiple payments share tx_hash=${q}; refuse. Use payment id:\n` +
        rows.map((r) => `  ${r.id} status=${r.status} refunded_at=${r.refunded_at || "(null)"}`).join("\n"),
    );
    process.exit(1);
  }
  row = rows[0];
} else if (looksLikeEmail) {
  const rows = db
    .prepare(
      `${SELECT} WHERE lower(u.email) = lower(?)
       AND p.status = 'finished' AND p.refunded_at IS NULL
       ORDER BY p.created_at DESC`,
    )
    .all(q);
  if (!rows.length) {
    console.error(
      `No finished non-refunded payment for email=${q.toLowerCase()}. Lookup first.`,
    );
    process.exit(1);
  }
  if (rows.length > 1) {
    console.error(
      `Multiple finished non-refunded payments for ${q.toLowerCase()}; refuse. Use payment id:\n` +
        rows
          .map(
            (r) =>
              `  ${r.id} tx=${r.tx_hash || "(null)"} status=${r.status}`,
          )
          .join("\n"),
    );
    process.exit(1);
  }
  row = rows[0];
} else {
  row = db.prepare(`${SELECT} WHERE p.id = ?`).get(q);
  if (!row) {
    console.error(`No payment with id=${q}`);
    process.exit(1);
  }
}

if (row.refunded_at) {
  console.error(
    `Already refunded: payment_id=${row.id} refunded_at=${row.refunded_at}` +
      (row.refund_note ? ` note=${row.refund_note}` : ""),
  );
  process.exit(1);
}

const now = new Date().toISOString();
const mark = db.prepare(
  `UPDATE payments SET refunded_at = ?, refund_note = COALESCE(?, refund_note)
   WHERE id = ? AND refunded_at IS NULL`,
);
const result = mark.run(now, note, row.id);
if (result.changes !== 1) {
  console.error(`Failed to mark refunded (race?): payment_id=${row.id}`);
  process.exit(1);
}

let planNote = "plan unchanged";
const otherActive = db
  .prepare(
    `SELECT COUNT(*) AS n FROM payments
     WHERE user_id = ? AND status = 'finished' AND refunded_at IS NULL AND id != ?`,
  )
  .get(row.user_id, row.id);

if (
  row.status === "finished" &&
  row.plan === "pro" &&
  otherActive &&
  otherActive.n === 0
) {
  db.prepare(
    `UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE id = ? AND plan = 'pro'`,
  ).run(row.user_id);
  planNote = "plan revoked to free (only active finished payment)";
} else if (row.plan === "pro" && otherActive && otherActive.n > 0) {
  planNote = `plan left pro (${otherActive.n} other finished non-refunded payment(s))`;
}

console.log("OK marked refunded:");
console.log(`  payment_id:  ${row.id}`);
console.log(`  email:       ${row.email || "(n/a)"}`);
console.log(`  tx_hash:     ${row.tx_hash || "(null)"}`);
console.log(`  refunded_at: ${now}`);
if (note) console.log(`  refund_note: ${note}`);
console.log(`  ${planNote}`);

db.close();
