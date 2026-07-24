import type {
  BracketSlice,
  CryptoTx,
  Disposal,
  LotState,
  TaxEstimate,
  TaxYearResult,
} from "./types";
import { matchTransfers } from "./transfers";
import { WRAP_PAIRS } from "./wraps";

interface CarryLot {
  quantity: number;
  totalCostJpy: number;
}

/**
 * Japan NTA guidance for crypto typically uses 移動平均法 (moving average).
 * - Buys / income receipts raise quantity and average unit cost.
 * - Sells realize gain = (proceeds − fees) − (qty × avg cost).
 * - Income/airdrop/staking: taxable at FMV on receipt; basis becomes FMV.
 * - Transfers: no realization; cost basis carries via match + carry queue.
 * - Fees as standalone side reduce basis / realize if paid in-asset.
 */
export function computeMovingAverage(txs: CryptoTx[]): {
  disposals: Disposal[];
  lots: Map<string, LotState>;
} {
  const { txs: matched } = matchTransfers(txs.filter((t) => !t.excluded));
  const sorted = [...matched].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    const rank = (s: CryptoTx["side"]) => {
      if (s === "transfer_in" || s === "buy" || s === "income" || s === "wrap")
        return 0;
      if (s === "fee") return 2;
      return 1;
    };
    return rank(a.side) - rank(b.side);
  });

  const lots = new Map<string, LotState>();
  const carry = new Map<string, CarryLot[]>();
  const disposals: Disposal[] = [];

  const getLot = (asset: string): LotState => {
    const key = asset.toUpperCase();
    let lot = lots.get(key);
    if (!lot) {
      lot = { asset: key, quantity: 0, avgCostJpy: 0, totalCostJpy: 0 };
      lots.set(key, lot);
    }
    return lot;
  };

  const pushCarry = (asset: string, quantity: number, totalCostJpy: number) => {
    const key = asset.toUpperCase();
    const q = carry.get(key) ?? [];
    q.push({ quantity, totalCostJpy });
    carry.set(key, q);
  };

  const popCarry = (
    asset: string,
    quantity: number,
  ): { quantity: number; totalCostJpy: number } | null => {
    const key = asset.toUpperCase();
    const q = carry.get(key);
    if (!q?.length) return null;
    // Prefer closest quantity match
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < q.length; i++) {
      const diff = Math.abs(q[i].quantity - quantity);
      if (diff < best) {
        best = diff;
        idx = i;
      }
    }
    const [item] = q.splice(idx, 1);
    return item;
  };

  for (const tx of sorted) {
    const lot = getLot(tx.asset);
    const qty = tx.quantity;
    const fee = tx.feeJpy ?? 0;

    if (tx.side === "income") {
      // Taxable receipt at FMV; basis becomes FMV (or manual override)
      const fmv = tx.jpyValue;
      const basisIn =
        tx.costBasisOverrideJpy != null ? tx.costBasisOverrideJpy : fmv;
      disposals.push({
        id: tx.id,
        date: tx.date,
        asset: lot.asset,
        quantity: qty,
        proceedsJpy: fmv,
        costBasisJpy: 0,
        gainJpy: fmv,
        source: tx.source,
        note: tx.note ?? "income/airdrop/staking",
        kind: "income",
        priceSource: tx.priceSource,
      });
      const newQty = lot.quantity + qty;
      const newCost = lot.totalCostJpy + basisIn + fee;
      lot.quantity = newQty;
      lot.totalCostJpy = newCost;
      lot.avgCostJpy = newQty > 0 ? newCost / newQty : 0;
      continue;
    }

    if (tx.side === "buy") {
      const cost =
        (tx.costBasisOverrideJpy != null ? tx.costBasisOverrideJpy : tx.jpyValue) +
        fee;
      const newQty = lot.quantity + qty;
      const newCost = lot.totalCostJpy + cost;
      lot.quantity = newQty;
      lot.totalCostJpy = newCost;
      lot.avgCostJpy = newQty > 0 ? newCost / newQty : 0;
      continue;
    }

    if (tx.side === "transfer_in") {
      const carried = popCarry(tx.asset, qty);
      const cost =
        tx.costBasisOverrideJpy != null
          ? tx.costBasisOverrideJpy
          : carried != null
            ? carried.totalCostJpy
            : tx.jpyValue > 0
              ? tx.jpyValue
              : lot.avgCostJpy * qty;
      const newQty = lot.quantity + qty;
      const newCost = lot.totalCostJpy + cost;
      lot.quantity = newQty;
      lot.totalCostJpy = newCost;
      lot.avgCostJpy = newQty > 0 ? newCost / newQty : 0;
      continue;
    }

    if (tx.side === "transfer_out") {
      const moveQty = Math.min(qty, lot.quantity || qty);
      const costBasis = lot.avgCostJpy * moveQty;
      pushCarry(tx.asset, moveQty, costBasis);
      lot.quantity = Math.max(0, lot.quantity - moveQty);
      lot.totalCostJpy = lot.avgCostJpy * lot.quantity;
      if (lot.quantity === 0) {
        lot.avgCostJpy = 0;
        lot.totalCostJpy = 0;
      }
      continue;
    }

    if (tx.side === "fee") {
      const feeQty = Math.min(qty, lot.quantity || qty);
      const costBasis =
        tx.costBasisOverrideJpy != null
          ? tx.costBasisOverrideJpy
          : lot.avgCostJpy * feeQty;
      disposals.push({
        id: tx.id,
        date: tx.date,
        asset: lot.asset,
        quantity: feeQty,
        proceedsJpy: 0,
        costBasisJpy: costBasis,
        gainJpy: -costBasis,
        source: tx.source,
        note: tx.note ?? "network/exchange fee",
        kind: "fee",
        priceSource: tx.priceSource,
      });
      // Full book rebuild: remove the cost actually attributed to this fee
      lot.quantity = Math.max(0, lot.quantity - feeQty);
      lot.totalCostJpy = Math.max(0, lot.totalCostJpy - costBasis);
      lot.avgCostJpy = lot.quantity > 0 ? lot.totalCostJpy / lot.quantity : 0;
      continue;
    }

    if (tx.side === "wrap") {
      // Non-taxable wrap/unwrap: move qty + cost to counterAsset (or WRAP_PAIRS)
      const toAsset = (
        tx.counterAsset ||
        WRAP_PAIRS[lot.asset] ||
        ""
      ).toUpperCase();
      if (!toAsset) continue;
      const moveQty = Math.min(qty, lot.quantity || qty);
      const moveCost =
        tx.costBasisOverrideJpy != null
          ? tx.costBasisOverrideJpy
          : lot.avgCostJpy * moveQty;
      lot.quantity = Math.max(0, lot.quantity - moveQty);
      lot.totalCostJpy = Math.max(0, lot.totalCostJpy - moveCost);
      lot.avgCostJpy = lot.quantity > 0 ? lot.totalCostJpy / lot.quantity : 0;

      const dest = getLot(toAsset);
      const newQty = dest.quantity + moveQty;
      const newCost = dest.totalCostJpy + moveCost;
      dest.quantity = newQty;
      dest.totalCostJpy = newCost;
      dest.avgCostJpy = newQty > 0 ? newCost / newQty : 0;
      continue;
    }

    if (tx.side === "sell") {
      const sellQty = Math.min(qty, lot.quantity || qty);
      const costBasis =
        tx.costBasisOverrideJpy != null
          ? tx.costBasisOverrideJpy
          : lot.avgCostJpy * sellQty;
      const proceeds = Math.max(0, tx.jpyValue - fee);
      disposals.push({
        id: tx.id,
        date: tx.date,
        asset: lot.asset,
        quantity: sellQty,
        proceedsJpy: proceeds,
        costBasisJpy: costBasis,
        gainJpy: proceeds - costBasis,
        source: tx.source,
        note: tx.note,
        kind: "sell",
        priceSource: tx.priceSource,
      });
      // Full lot rebuild: book value removed equals cost used for the disposal
      lot.quantity = Math.max(0, lot.quantity - sellQty);
      lot.totalCostJpy = Math.max(0, lot.totalCostJpy - costBasis);
      lot.avgCostJpy = lot.quantity > 0 ? lot.totalCostJpy / lot.quantity : 0;
    }
  }

  return { disposals, lots };
}

export function summarizeTaxYear(
  txs: CryptoTx[],
  year: number,
): TaxYearResult {
  const yearTxs = txs.filter((t) => t.date.startsWith(String(year)));
  const history = txs.filter((t) => t.date.slice(0, 4) <= String(year));
  const { matches } = matchTransfers(history.filter((t) => !t.excluded));
  const { disposals, lots } = computeMovingAverage(history);
  const yearDisposals = disposals.filter((d) =>
    d.date.startsWith(String(year)),
  );

  const totalProceedsJpy = yearDisposals.reduce(
    (s, d) => s + d.proceedsJpy,
    0,
  );
  const totalCostBasisJpy = yearDisposals.reduce(
    (s, d) => s + d.costBasisJpy,
    0,
  );
  const totalGainJpy = yearDisposals.reduce((s, d) => s + d.gainJpy, 0);
  const totalPositiveGainJpy = yearDisposals
    .filter((d) => d.gainJpy > 0)
    .reduce((s, d) => s + d.gainJpy, 0);
  const totalLossJpy = yearDisposals
    .filter((d) => d.gainJpy < 0)
    .reduce((s, d) => s + d.gainJpy, 0);
  const totalIncomeJpy = yearDisposals
    .filter((d) => d.kind === "income")
    .reduce((s, d) => s + d.gainJpy, 0);

  return {
    year,
    disposals: yearDisposals,
    totalProceedsJpy,
    totalCostBasisJpy,
    totalGainJpy,
    totalPositiveGainJpy,
    totalLossJpy,
    totalIncomeJpy,
    endingLots: [...lots.values()].filter((l) => l.quantity > 1e-12),
    txCount: yearTxs.length,
    activeTxCount: yearTxs.filter((t) => !t.excluded).length,
    excludedTxCount: yearTxs.filter((t) => t.excluded).length,
    matchedTransferCount: matches.length,
  };
}

export const INCOME_TAX_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 1_950_000, rate: 0.05 },
  { upTo: 3_300_000, rate: 0.1 },
  { upTo: 6_950_000, rate: 0.2 },
  { upTo: 9_000_000, rate: 0.23 },
  { upTo: 18_000_000, rate: 0.33 },
  { upTo: 40_000_000, rate: 0.4 },
  { upTo: Infinity, rate: 0.45 },
];

const RECONSTRUCTION_SURTAX = 0.021;
const RESIDENCE_TAX_RATE = 0.1;

export function incomeTaxOn(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const b of INCOME_TAX_BRACKETS) {
    const slice = Math.min(taxableIncome, b.upTo) - prev;
    if (slice > 0) tax += slice * b.rate;
    if (taxableIncome <= b.upTo) break;
    prev = b.upTo;
  }
  return tax;
}

function reconstructionOn(incomeTax: number): number {
  return incomeTax * RECONSTRUCTION_SURTAX;
}

function totalNationalAndLocal(taxableIncome: number): number {
  const income = incomeTaxOn(Math.max(0, taxableIncome));
  const base = Math.max(0, taxableIncome);
  return income + reconstructionOn(income) + base * RESIDENCE_TAX_RATE;
}

export function allocateCryptoAcrossBrackets(
  otherTaxableIncomeJpy: number,
  cryptoGainJpy: number,
): BracketSlice[] {
  const gain = Math.max(0, cryptoGainJpy);
  const base = Math.max(0, otherTaxableIncomeJpy);
  if (gain <= 0) return [];

  const slices: BracketSlice[] = [];
  let cursor = base;
  let remaining = gain;

  for (const b of INCOME_TAX_BRACKETS) {
    if (remaining <= 0) break;
    const roomInBracket = Math.max(0, b.upTo - cursor);
    if (roomInBracket <= 0) {
      cursor = Math.max(cursor, b.upTo);
      continue;
    }
    const take = Math.min(remaining, roomInBracket);
    slices.push({
      upTo: b.upTo,
      rate: b.rate,
      cryptoAmountJpy: take,
      incomeTaxJpy: take * b.rate,
    });
    remaining -= take;
    cursor += take;
  }

  return slices;
}

function marginalRateAt(taxableIncome: number): number {
  const income = Math.max(0, taxableIncome);
  for (const b of INCOME_TAX_BRACKETS) {
    if (income <= b.upTo) {
      return b.rate * (1 + RECONSTRUCTION_SURTAX) + RESIDENCE_TAX_RATE;
    }
  }
  return 0.45 * (1 + RECONSTRUCTION_SURTAX) + RESIDENCE_TAX_RATE;
}

/**
 * Optional bracket sketch only. Crypto-only product — not a final tax bill.
 * Negative crypto gain → ¥0 incremental national tax sketch.
 */
export function estimateJapanTax(
  cryptoGainJpy: number,
  otherIncomeJpy = 0,
  options?: { incomeProvided?: boolean },
): TaxEstimate {
  const gain = Math.max(0, cryptoGainJpy);
  const base = Math.max(0, otherIncomeJpy);
  const withCrypto = base + gain;
  const incomeProvided = options?.incomeProvided ?? true;

  const brackets = allocateCryptoAcrossBrackets(base, gain);
  const incomeTaxJpy = Math.max(0, incomeTaxOn(withCrypto) - incomeTaxOn(base));
  const reconstructionTaxJpy = reconstructionOn(incomeTaxJpy);
  const residenceTaxJpy = gain * RESIDENCE_TAX_RATE;
  const cryptoOnlyTaxJpy =
    incomeTaxJpy + reconstructionTaxJpy + residenceTaxJpy;

  const taxWithoutCryptoJpy = totalNationalAndLocal(base);
  const taxWithCryptoJpy = totalNationalAndLocal(withCrypto);

  return {
    taxableGainJpy: cryptoGainJpy,
    otherIncomeJpy: base,
    totalTaxableIncomeJpy: base + cryptoGainJpy,
    incomeTaxJpy,
    reconstructionTaxJpy,
    residenceTaxJpy,
    totalTaxJpy: cryptoOnlyTaxJpy,
    cryptoOnlyTaxJpy,
    taxWithoutCryptoJpy,
    taxWithCryptoJpy,
    cryptoIncrementalTaxJpy: cryptoOnlyTaxJpy,
    effectiveRate: gain > 0 ? cryptoOnlyTaxJpy / gain : 0,
    marginalRate: marginalRateAt(withCrypto),
    brackets,
    incomeProvided,
  };
}

export function formatJpy(n: number): string {
  const rounded = Math.round(n);
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(rounded);
}

export function formatQty(n: number): string {
  if (Math.abs(n) >= 1000) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(4);
  return n.toFixed(8).replace(/\.?0+$/, "") || "0";
}
