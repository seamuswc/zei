import type { CryptoTx, PriceSource, TxSide } from "@/lib/tax/types";
import { isWrapPair } from "@/lib/tax/wraps";
import {
  defiLabelFor,
  isAirdropDistributor,
  isLendingPool,
} from "@/lib/import/defi-labels";

/** Intermediate wallet transfer leg before side classification. */
export interface WalletLeg {
  id: string;
  date: string;
  asset: string;
  quantity: number;
  jpyValue: number;
  unitPriceJpy?: number;
  priceSource?: PriceSource;
  /** Relative to the synced wallet. */
  direction: "in" | "out";
  from: string;
  to: string;
  txHash: string;
  walletAddress: string;
  note?: string;
  tokenContract?: string;
  /** Known ERC-20 / priced asset (false → candidate spam). */
  knownAsset?: boolean;
  /** Gas fee legs are left as fee and ignored by swap/transfer grouping. */
  isFee?: boolean;
}

export interface ClassifyWalletOptions {
  /** Other user-linked wallet addresses (lowercase or any case). */
  linkedAddresses?: string[];
}

function approxEq(a: number, b: number, tol = 0.02): boolean {
  const mid = (Math.abs(a) + Math.abs(b)) / 2;
  return Math.abs(a - b) <= Math.max(mid * tol, 1e-8);
}

function normalizeAddrSet(addrs: string[] | undefined): Set<string> {
  const set = new Set<string>();
  for (const a of addrs ?? []) {
    const t = a.trim().toLowerCase();
    if (t) set.add(t);
  }
  return set;
}

function counterparty(leg: WalletLeg): string {
  return (leg.direction === "in" ? leg.from : leg.to).toLowerCase();
}

function sharedSwapJpy(outLeg: WalletLeg, inLeg: WalletLeg): number {
  // Prefer a priced leg; if both priced, prefer the higher FMV (usually more reliable).
  const a = outLeg.jpyValue > 0 ? outLeg.jpyValue : 0;
  const b = inLeg.jpyValue > 0 ? inLeg.jpyValue : 0;
  if (a > 0 && b > 0) return Math.round(Math.max(a, b));
  if (a > 0) return Math.round(a);
  if (b > 0) return Math.round(b);
  return 0;
}

function withAutoNote(base: string | undefined, tag: string): string {
  const prefix = base?.trim() ? `${base.trim()} · ` : "";
  return `${prefix}auto:${tag}`;
}

function toTx(
  leg: WalletLeg,
  side: TxSide,
  patch?: Partial<CryptoTx>,
): CryptoTx {
  return {
    id: leg.id,
    date: leg.date,
    asset: leg.asset.toUpperCase(),
    side,
    quantity: leg.quantity,
    jpyValue: leg.jpyValue,
    unitPriceJpy: leg.unitPriceJpy,
    priceSource: leg.priceSource,
    source: "wallet",
    walletAddress: leg.walletAddress,
    note: leg.note,
    txHash: leg.txHash,
    tokenContract: leg.tokenContract,
    ...patch,
  };
}

interface NetAsset {
  asset: string;
  qty: number;
  /** Representative leg for metadata / pricing (largest abs contribution). */
  leg: WalletLeg;
  jpyValue: number;
  direction: "in" | "out";
}

/**
 * Net token legs in a hash group (fees excluded).
 * Multi-hop DEX routes often cancel intermediate tokens → one out + one in.
 */
function netAssets(legs: WalletLeg[]): NetAsset[] {
  const map = new Map<
    string,
    { qty: number; jpyIn: number; jpyOut: number; best: WalletLeg; bestAbs: number }
  >();

  for (const leg of legs) {
    const asset = leg.asset.toUpperCase();
    const cur = map.get(asset) ?? {
      qty: 0,
      jpyIn: 0,
      jpyOut: 0,
      best: leg,
      bestAbs: 0,
    };
    const signed = leg.direction === "in" ? leg.quantity : -leg.quantity;
    cur.qty += signed;
    if (leg.direction === "in") cur.jpyIn += leg.jpyValue;
    else cur.jpyOut += leg.jpyValue;
    if (leg.quantity >= cur.bestAbs) {
      cur.best = leg;
      cur.bestAbs = leg.quantity;
    }
    map.set(asset, cur);
  }

  const nets: NetAsset[] = [];
  for (const [asset, cur] of map) {
    if (Math.abs(cur.qty) < 1e-12) continue;
    const direction: "in" | "out" = cur.qty > 0 ? "in" : "out";
    nets.push({
      asset,
      qty: Math.abs(cur.qty),
      leg: cur.best,
      jpyValue: direction === "in" ? cur.jpyIn : cur.jpyOut,
      direction,
    });
  }
  return nets;
}

function classifyHashGroup(
  legs: WalletLeg[],
  linked: Set<string>,
): CryptoTx[] {
  const fees = legs.filter((l) => l.isFee);
  const valueLegs = legs.filter((l) => !l.isFee);
  const out: CryptoTx[] = fees.map((l) =>
    toTx(l, "fee", { note: withAutoNote(l.note, "fee") }),
  );

  if (valueLegs.length === 0) return out;

  const nets = netAssets(valueLegs);
  const outs = nets.filter((n) => n.direction === "out");
  const ins = nets.filter((n) => n.direction === "in");
  const touchesLending = valueLegs.some((l) =>
    isLendingPool(counterparty(l)),
  );

  // 1) Wrap / 2) Swap — only when the hash is not a lending-pool interaction.
  // (Aave supply mints aTokens in-hash and must not become a fake crypto↔crypto trade.)
  if (!touchesLending && outs.length === 1 && ins.length === 1) {
    const o = outs[0];
    const i = ins[0];
    if (isWrapPair(o.asset, i.asset) && approxEq(o.qty, i.qty)) {
      out.push({
        id: `wrap_${o.leg.id}`,
        date: o.leg.date,
        asset: o.asset,
        side: "wrap",
        quantity: o.qty,
        jpyValue: 0,
        source: "wallet",
        walletAddress: o.leg.walletAddress,
        note: withAutoNote(
          undefined,
          `wrap ${o.asset}→${i.asset} (not taxed)`,
        ),
        txHash: o.leg.txHash,
        counterAsset: i.asset,
        priceSource: "derived_trade",
      });
      return out;
    }

    // Crypto↔crypto swap: shared JPY on sell+buy (matches CSV trade expansion)
    if (o.asset !== i.asset) {
      const sellLeg: WalletLeg = {
        ...o.leg,
        asset: o.asset,
        quantity: o.qty,
        jpyValue: o.jpyValue,
      };
      const buyLeg: WalletLeg = {
        ...i.leg,
        asset: i.asset,
        quantity: i.qty,
        jpyValue: i.jpyValue,
      };
      const jpy = sharedSwapJpy(sellLeg, buyLeg);
      const unitSell = o.qty ? jpy / o.qty : undefined;
      const unitBuy = i.qty ? jpy / i.qty : undefined;
      out.push(
        toTx(sellLeg, "sell", {
          jpyValue: jpy,
          unitPriceJpy: unitSell,
          priceSource: "derived_trade",
          counterAsset: i.asset,
          note: withAutoNote(o.leg.note, `swap→${i.asset}`),
        }),
        toTx(buyLeg, "buy", {
          id: `${buyLeg.id}_swapbuy`,
          jpyValue: jpy,
          unitPriceJpy: unitBuy,
          priceSource: "derived_trade",
          counterAsset: o.asset,
          note: withAutoNote(i.leg.note, `swap←${o.asset}`),
        }),
      );
      return out;
    }
  }

  // 3–5) Single-sided / lending / transfer / income / buy|sell
  const oneSidedLending = touchesLending && outs.length + ins.length === 1;

  for (const leg of valueLegs) {
    const cp = counterparty(leg);
    const label = defiLabelFor(cp);
    const selfOrLinked =
      linked.has(cp) || cp === leg.walletAddress.toLowerCase();

    // Self / internal transfer between linked wallets
    if (selfOrLinked) {
      const side: TxSide =
        leg.direction === "in" ? "transfer_in" : "transfer_out";
      out.push(
        toTx(leg, side, {
          jpyValue: 0,
          note: withAutoNote(leg.note, `self-transfer ${cp.slice(0, 8)}…`),
          priceSource: leg.priceSource ?? "unknown",
        }),
      );
      continue;
    }

    if (isLendingPool(cp)) {
      // One-sided vs pool: best-effort borrow / repay (supply/withdraw need Review).
      if (oneSidedLending) {
        if (leg.direction === "in") {
          out.push(
            toTx(leg, "borrow", {
              note: withAutoNote(
                leg.note,
                `${label?.note ?? "lending"} borrow? (check Review)`,
              ),
            }),
          );
        } else {
          out.push(
            toTx(leg, "repay", {
              note: withAutoNote(
                leg.note,
                `${label?.note ?? "lending"} repay? (check Review)`,
              ),
            }),
          );
        }
        continue;
      }
      // Mixed hash (e.g. supply + aToken mint): treat as non-taxable transfer, not swap.
      const side: TxSide =
        leg.direction === "in" ? "transfer_in" : "transfer_out";
      out.push(
        toTx(leg, side, {
          jpyValue: 0,
          note: withAutoNote(
            leg.note,
            `${label?.note ?? "lending"} transfer (verify borrow/repay in Review)`,
          ),
        }),
      );
      continue;
    }

    // Skip aToken / unknown legs paired with a lending interaction
    if (touchesLending && leg.knownAsset === false) {
      continue;
    }

    // High-confidence airdrop / claim income
    if (
      leg.direction === "in" &&
      isAirdropDistributor(cp) &&
      outs.length === 0
    ) {
      out.push(
        toTx(leg, "income", {
          note: withAutoNote(
            leg.note,
            `${label?.note ?? "airdrop"} income`,
          ),
        }),
      );
      continue;
    }

    // Light spam filter: unknown unpaid inbound with no DeFi label
    if (
      leg.direction === "in" &&
      leg.knownAsset === false &&
      !(leg.jpyValue > 0) &&
      !label
    ) {
      continue;
    }

    const side: TxSide = leg.direction === "in" ? "buy" : "sell";
    out.push(toTx(leg, side));
  }

  return out;
}

/**
 * Classify raw wallet legs into CryptoTx sides.
 * Manual Review edits remain the override after import.
 */
export function classifyWalletLegs(
  legs: WalletLeg[],
  options: ClassifyWalletOptions = {},
): CryptoTx[] {
  const linked = normalizeAddrSet(options.linkedAddresses);
  // Always treat the synced address(es) on legs as linked for self-checks
  for (const leg of legs) {
    if (leg.walletAddress) linked.add(leg.walletAddress.toLowerCase());
  }

  const byHash = new Map<string, WalletLeg[]>();
  const noHash: WalletLeg[] = [];
  for (const leg of legs) {
    if (!leg.txHash) {
      noHash.push(leg);
      continue;
    }
    const list = byHash.get(leg.txHash) ?? [];
    list.push(leg);
    byHash.set(leg.txHash, list);
  }

  const txs: CryptoTx[] = [];
  for (const group of byHash.values()) {
    txs.push(...classifyHashGroup(group, linked));
  }
  for (const leg of noHash) {
    if (leg.isFee) {
      txs.push(toTx(leg, "fee"));
      continue;
    }
    txs.push(toTx(leg, leg.direction === "in" ? "buy" : "sell"));
  }

  return txs.sort((a, b) => a.date.localeCompare(b.date));
}
