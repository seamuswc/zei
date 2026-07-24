import { getDb } from "@/lib/db";
import type { CryptoTx } from "@/lib/tax/types";
import { summarizeTaxYear } from "@/lib/tax/engine";
import {
  applyLossCarrySeries,
  type YearCarryRow,
} from "@/lib/tax/loss-carry";

export function loadLedger(userId: string): {
  txs: CryptoTx[];
  otherIncomeJpy: number;
  incomeProvided: boolean;
  year: number;
} {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT txs_json, other_income_jpy, income_provided, year FROM ledgers WHERE user_id = ?`,
    )
    .get(userId) as
    | {
        txs_json: string;
        other_income_jpy: number;
        income_provided: number;
        year: number;
      }
    | undefined;

  if (!row) {
    return { txs: [], otherIncomeJpy: 0, incomeProvided: false, year: 2025 };
  }
  return {
    txs: JSON.parse(row.txs_json) as CryptoTx[],
    otherIncomeJpy: row.other_income_jpy,
    incomeProvided: !!row.income_provided,
    year: row.year,
  };
}

export function saveLedger(
  userId: string,
  data: {
    txs: CryptoTx[];
    otherIncomeJpy: number;
    incomeProvided: boolean;
    year: number;
  },
) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO ledgers (user_id, txs_json, other_income_jpy, income_provided, year, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       txs_json = excluded.txs_json,
       other_income_jpy = excluded.other_income_jpy,
       income_provided = excluded.income_provided,
       year = excluded.year,
       updated_at = excluded.updated_at`,
  ).run(
    userId,
    JSON.stringify(data.txs),
    data.otherIncomeJpy,
    data.incomeProvided ? 1 : 0,
    data.year,
    now,
  );

  // Refresh multi-year crypto nets + loss carry
  refreshTaxYears(userId, data.txs, data.otherIncomeJpy);
}

export function refreshTaxYears(
  userId: string,
  txs: CryptoTx[],
  otherMiscJpy: number,
) {
  const years = new Set<number>();
  for (const t of txs) {
    const y = Number(t.date.slice(0, 4));
    if (Number.isFinite(y)) years.add(y);
  }
  if (!years.size) years.add(new Date().getFullYear());

  const sorted = [...years].sort((a, b) => a - b);
  // Include prior empty years between min and max for carry continuity
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const seriesYears: number[] = [];
  for (let y = min; y <= max; y++) seriesYears.push(y);

  const nets = seriesYears.map((year) => ({
    year,
    netGainJpy: summarizeTaxYear(txs, year).totalGainJpy,
  }));

  const carried = applyLossCarrySeries(nets);
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO tax_years (user_id, year, net_gain_jpy, carried_in_jpy, carried_out_jpy, other_misc_jpy, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, year) DO UPDATE SET
       net_gain_jpy = excluded.net_gain_jpy,
       carried_in_jpy = excluded.carried_in_jpy,
       carried_out_jpy = excluded.carried_out_jpy,
       other_misc_jpy = excluded.other_misc_jpy,
       notes = excluded.notes`,
  );

  for (const row of carried) {
    upsert.run(
      userId,
      row.year,
      row.netGainJpy,
      row.carriedInJpy,
      row.carriedOutJpy,
      otherMiscJpy,
      row.notes,
    );
  }
}

export function listTaxYears(userId: string): YearCarryRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT year, net_gain_jpy, carried_in_jpy, carried_out_jpy, notes
       FROM tax_years WHERE user_id = ? ORDER BY year ASC`,
    )
    .all(userId) as Array<{
    year: number;
    net_gain_jpy: number;
    carried_in_jpy: number;
    carried_out_jpy: number;
    notes: string | null;
  }>;

  return rows.map((r) => ({
    year: r.year,
    netGainJpy: r.net_gain_jpy,
    carriedInJpy: r.carried_in_jpy,
    carriedOutJpy: r.carried_out_jpy,
    taxableAfterCarryJpy: r.net_gain_jpy + r.carried_in_jpy,
    notes: r.notes ?? "",
  }));
}
