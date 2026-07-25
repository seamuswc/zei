import type { CryptoTx, TxSide } from "@/lib/tax/types";
import { expandCryptoTrade } from "@/lib/tax/transfers";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const SIDES = new Set<TxSide>([
  "buy",
  "sell",
  "transfer_in",
  "transfer_out",
  "income",
  "fee",
  "wrap",
  "bridge",
]);

/**
 * CSV formats:
 * 1) date,asset,side,quantity,jpy_value[,fee_jpy][,note]
 * 2) trade rows: date,asset,trade,qty,jpy,fee,note,counter_asset,counter_qty
 *    side may also be "trade" / "swap"
 * 3) income/airdrop/staking via side=income
 */
export function parseSpreadsheetCsv(text: string): {
  txs: CryptoTx[];
  errors: string[];
} {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { txs: [], errors: ["File is empty."] };
  }

  const errors: string[] = [];
  const txs: CryptoTx[] = [];

  let start = 0;
  const headerCols = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const hasHeader =
    headerCols.includes("date") &&
    (headerCols.includes("asset") || headerCols.includes("symbol"));
  if (hasHeader) start = 1;

  const idx = (name: string) => headerCols.indexOf(name);

  for (let i = start; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 5) {
      errors.push(`Row ${i + 1}: expected at least 5 columns.`);
      continue;
    }

    const dateRaw = hasHeader && idx("date") >= 0 ? cols[idx("date")] : cols[0];
    const assetRaw =
      hasHeader && (idx("asset") >= 0 || idx("symbol") >= 0)
        ? cols[idx("asset") >= 0 ? idx("asset") : idx("symbol")]
        : cols[1];
    const sideRaw =
      hasHeader && idx("side") >= 0 ? cols[idx("side")] : cols[2];
    const qtyRaw =
      hasHeader && (idx("quantity") >= 0 || idx("qty") >= 0)
        ? cols[idx("quantity") >= 0 ? idx("quantity") : idx("qty")]
        : cols[3];
    const jpyRaw =
      hasHeader &&
      (idx("jpy_value") >= 0 || idx("jpy") >= 0 || idx("amount_jpy") >= 0)
        ? cols[
            idx("jpy_value") >= 0
              ? idx("jpy_value")
              : idx("jpy") >= 0
                ? idx("jpy")
                : idx("amount_jpy")
          ]
        : cols[4];
    const feeRaw =
      hasHeader && idx("fee_jpy") >= 0
        ? cols[idx("fee_jpy")]
        : cols[5];
    const noteRaw =
      hasHeader && idx("note") >= 0 ? cols[idx("note")] : cols[6];
    const counterAssetRaw =
      hasHeader && idx("counter_asset") >= 0
        ? cols[idx("counter_asset")]
        : cols[7];
    const counterQtyRaw =
      hasHeader && idx("counter_qty") >= 0
        ? cols[idx("counter_qty")]
        : cols[8];

    const date = normalizeDate(dateRaw);
    const asset = assetRaw.trim().toUpperCase();
    let side = sideRaw.trim().toLowerCase().replace("-", "_");
    if (side === "airdrop" || side === "staking" || side === "reward") {
      side = "income";
    }
    const quantity = Number(String(qtyRaw).replace(/,/g, ""));
    const jpyValue = Number(String(jpyRaw).replace(/,/g, ""));
    const feeJpy = feeRaw
      ? Number(String(feeRaw).replace(/,/g, ""))
      : undefined;

    if (!date) {
      errors.push(`Row ${i + 1}: invalid date "${dateRaw}".`);
      continue;
    }
    if (!asset) {
      errors.push(`Row ${i + 1}: missing asset.`);
      continue;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`Row ${i + 1}: invalid quantity.`);
      continue;
    }
    if (!Number.isFinite(jpyValue) || jpyValue < 0) {
      errors.push(`Row ${i + 1}: invalid jpy_value.`);
      continue;
    }

    if (side === "trade" || side === "swap") {
      const counterAsset = (counterAssetRaw || "").trim().toUpperCase();
      const counterQty = Number(String(counterQtyRaw || "").replace(/,/g, ""));
      if (!counterAsset || !Number.isFinite(counterQty) || counterQty <= 0) {
        errors.push(
          `Row ${i + 1}: trade requires counter_asset and counter_qty.`,
        );
        continue;
      }
      txs.push(
        ...expandCryptoTrade({
          date,
          sellAsset: asset,
          sellQty: quantity,
          buyAsset: counterAsset,
          buyQty: counterQty,
          jpyValue,
          source: "csv",
          note: noteRaw?.trim() || "crypto trade",
          feeJpy: Number.isFinite(feeJpy) ? feeJpy : undefined,
        }),
      );
      continue;
    }

    if (side === "wrap" || side === "bridge") {
      const counterAsset = (counterAssetRaw || "").trim().toUpperCase();
      if (side === "wrap" && !counterAsset) {
        errors.push(`Row ${i + 1}: wrap requires counter_asset.`);
        continue;
      }
      txs.push({
        id: uid("csv"),
        date,
        asset,
        side: side as TxSide,
        quantity,
        jpyValue: 0,
        feeJpy: Number.isFinite(feeJpy) ? feeJpy : undefined,
        source: "csv",
        note:
          noteRaw?.trim() ||
          (side === "wrap"
            ? `wrap→${counterAsset}`
            : `bridge (not taxed)`),
        counterAsset: counterAsset || undefined,
        priceSource: "csv_provided",
      });
      continue;
    }

    if (!SIDES.has(side as TxSide)) {
      errors.push(`Row ${i + 1}: unknown side "${sideRaw}".`);
      continue;
    }

    txs.push({
      id: uid("csv"),
      date,
      asset,
      side: side as TxSide,
      quantity,
      jpyValue,
      feeJpy: Number.isFinite(feeJpy) ? feeJpy : undefined,
      source: "csv",
      note: noteRaw?.trim() || undefined,
      priceSource: "csv_provided",
      unitPriceJpy: quantity ? jpyValue / quantity : undefined,
    });
  }

  return { txs, errors };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return null;
}

export const SAMPLE_CSV = `date,asset,side,quantity,jpy_value,fee_jpy,note,counter_asset,counter_qty
2025-01-12,BTC,buy,0.05,750000,500,bitFlyer spot,,
2025-02-01,ETH,income,0.1,40000,0,staking reward,,
2025-03-02,ETH,buy,1.2,480000,300,Coincheck,,
2025-04-10,BTC,transfer_out,0.01,0,0,to wallet,,
2025-04-10,BTC,transfer_in,0.01,0,0,from exchange,,
2025-06-18,BTC,sell,0.02,420000,400,Take profit,,
2025-07-01,ETH,trade,0.2,90000,200,swap to SOL,SOL,3
2025-09-01,ETH,sell,0.5,220000,200,Partial exit,,
2025-11-20,SOL,buy,10,280000,150,GMO Coin,,
`;
