import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "zei.db");

let _db: Database.Database | null = null;

function migrate(db: Database.Database) {
  const userCols = db
    .prepare(`PRAGMA table_info(users)`)
    .all() as Array<{ name: string }>;
  const userNames = new Set(userCols.map((c) => c.name));
  if (!userNames.has("email_verified_at")) {
    db.exec(`ALTER TABLE users ADD COLUMN email_verified_at TEXT`);
  }

  const payCols = db
    .prepare(`PRAGMA table_info(payments)`)
    .all() as Array<{ name: string }>;
  const payNames = new Set(payCols.map((c) => c.name));
  if (payCols.length > 0) {
    if (!payNames.has("amount_raw")) {
      db.exec(`ALTER TABLE payments ADD COLUMN amount_raw TEXT`);
    }
    if (!payNames.has("ref_code")) {
      db.exec(`ALTER TABLE payments ADD COLUMN ref_code TEXT`);
    }
    if (!payNames.has("tx_hash")) {
      db.exec(`ALTER TABLE payments ADD COLUMN tx_hash TEXT`);
    }
    if (!payNames.has("from_address")) {
      db.exec(`ALTER TABLE payments ADD COLUMN from_address TEXT`);
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS email_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL
    );
  `);
}

export function getDb(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      plan_expires_at TEXT,
      email_verified_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ledgers (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      txs_json TEXT NOT NULL,
      other_income_jpy REAL NOT NULL DEFAULT 0,
      income_provided INTEGER NOT NULL DEFAULT 0,
      year INTEGER NOT NULL DEFAULT 2025,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tax_years (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      net_gain_jpy REAL NOT NULL DEFAULT 0,
      carried_in_jpy REAL NOT NULL DEFAULT 0,
      carried_out_jpy REAL NOT NULL DEFAULT 0,
      other_misc_jpy REAL NOT NULL DEFAULT 0,
      notes TEXT,
      PRIMARY KEY (user_id, year)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      invoice_id TEXT,
      amount REAL,
      currency TEXT,
      status TEXT NOT NULL,
      raw_json TEXT,
      created_at TEXT NOT NULL,
      amount_raw TEXT,
      ref_code TEXT,
      tx_hash TEXT,
      from_address TEXT
    );

    CREATE TABLE IF NOT EXISTS email_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL
    );
  `);
  migrate(_db);
  return _db;
}
