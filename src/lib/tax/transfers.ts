import type { CryptoTx, TransferMatch } from "@/lib/tax/types";

function approxEq(a: number, b: number, tol = 0.002): boolean {
  if (a === 0 && b === 0) return true;
  const mid = (Math.abs(a) + Math.abs(b)) / 2;
  return Math.abs(a - b) <= Math.max(mid * tol, 1e-8);
}

function dayDiff(a: string, b: string): number {
  const ms =
    Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
  return ms;
}

/** Max calendar-day gap for exchange↔wallet hop matching (was 3; widened carefully). */
export const TRANSFER_MATCH_MAX_DAYS = 10;

/**
 * Match transfer_out ↔ transfer_in (same asset, ~same qty, within TRANSFER_MATCH_MAX_DAYS)
 * so cost basis carries and hops are not treated as buys/sells.
 */
export function matchTransfers(txs: CryptoTx[]): {
  txs: CryptoTx[];
  matches: TransferMatch[];
} {
  const working = txs.map((t) => ({ ...t }));
  const outs = working.filter(
    (t) => t.side === "transfer_out" && !t.excluded && !t.matchedTransferId,
  );
  const ins = working.filter(
    (t) => t.side === "transfer_in" && !t.excluded && !t.matchedTransferId,
  );
  const usedIn = new Set<string>();
  const matches: TransferMatch[] = [];

  for (const out of outs) {
    const candidate = ins
      .filter(
        (i) =>
          !usedIn.has(i.id) &&
          i.asset.toUpperCase() === out.asset.toUpperCase() &&
          approxEq(i.quantity, out.quantity) &&
          dayDiff(i.date, out.date) <= TRANSFER_MATCH_MAX_DAYS,
      )
      .sort(
        (a, b) =>
          dayDiff(a.date, out.date) - dayDiff(b.date, out.date) ||
          Math.abs(a.quantity - out.quantity) -
            Math.abs(b.quantity - out.quantity),
      )[0];

    if (!candidate) continue;
    usedIn.add(candidate.id);
    const id = `xfer_${out.id}_${candidate.id}`;
    out.matchedTransferId = id;
    candidate.matchedTransferId = id;
    // Carry basis: force in to use engine carry (jpy 0)
    candidate.jpyValue = 0;
    out.jpyValue = 0;
    out.note = `${out.note ? `${out.note} · ` : ""}matched→${candidate.source}`;
    candidate.note = `${candidate.note ? `${candidate.note} · ` : ""}matched←${out.source}`;
    matches.push({
      id,
      asset: out.asset.toUpperCase(),
      quantity: out.quantity,
      outId: out.id,
      inId: candidate.id,
      outDate: out.date,
      inDate: candidate.date,
    });
  }

  return { txs: working, matches };
}

/** Expand a crypto↔crypto trade into sell(base) + buy(quote) at shared JPY FMV. */
export function expandCryptoTrade(options: {
  date: string;
  sellAsset: string;
  sellQty: number;
  buyAsset: string;
  buyQty: number;
  jpyValue: number;
  source: CryptoTx["source"];
  exchange?: string;
  note?: string;
  feeJpy?: number;
}): CryptoTx[] {
  const idBase = `tr_${Math.random().toString(36).slice(2, 8)}`;
  const jpy = Math.round(options.jpyValue);
  return [
    {
      id: `${idBase}_sell`,
      date: options.date,
      asset: options.sellAsset.toUpperCase(),
      side: "sell",
      quantity: options.sellQty,
      jpyValue: jpy,
      feeJpy: options.feeJpy,
      source: options.source,
      exchange: options.exchange,
      note: options.note ?? `trade→${options.buyAsset}`,
      counterAsset: options.buyAsset.toUpperCase(),
      priceSource: "derived_trade",
      unitPriceJpy: options.sellQty ? jpy / options.sellQty : undefined,
    },
    {
      id: `${idBase}_buy`,
      date: options.date,
      asset: options.buyAsset.toUpperCase(),
      side: "buy",
      quantity: options.buyQty,
      jpyValue: jpy,
      source: options.source,
      exchange: options.exchange,
      note: options.note ?? `trade←${options.sellAsset}`,
      counterAsset: options.sellAsset.toUpperCase(),
      priceSource: "derived_trade",
      unitPriceJpy: options.buyQty ? jpy / options.buyQty : undefined,
    },
  ];
}
