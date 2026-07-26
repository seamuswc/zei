"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CryptoTx } from "@/lib/tax/types";
import type { YearCarryRow } from "@/lib/tax/loss-carry";
import {
  estimateJapanTax,
  summarizeTaxYear,
} from "@/lib/tax/engine";
import { matchTransfers } from "@/lib/tax/transfers";
import { collapseWraps } from "@/lib/tax/collapse-wraps";
import { applyLossCarrySeries } from "@/lib/tax/loss-carry";
import { filingTaxYears } from "@/lib/billing";

const LINKS_STORAGE_KEY = "zei_linked_accounts";

/** Map ledger `exchange` labels (or ids) → link badge ids. */
const EXCHANGE_LINK_IDS: Record<string, string> = {
  bitflyer: "bitflyer",
  coincheck: "coincheck",
  gmo: "gmo",
  "gmo coin": "gmo",
  bitbank: "bitbank",
  "binance-jp": "binance-jp",
  "binance japan": "binance-jp",
  zaif: "zaif",
  binance: "binance",
  bybit: "bybit",
  okx: "okx",
  kraken: "kraken",
  kucoin: "kucoin",
};

function resolveExchangeLinkId(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  return EXCHANGE_LINK_IDS[key] ?? null;
}

type StoredLinks = {
  v: 1;
  linkedWallets: string[];
  walletEnsLabels: Record<string, string>;
  linkedExchanges: string[];
};

function readStoredLinks(): StoredLinks | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LINKS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLinks>;
    const wallets = Array.isArray(parsed.linkedWallets)
      ? parsed.linkedWallets
          .filter((a): a is string => typeof a === "string")
          .map((a) => a.trim().toLowerCase())
          .filter(Boolean)
      : [];
    const exchanges = Array.isArray(parsed.linkedExchanges)
      ? parsed.linkedExchanges.filter(
          (id): id is string => typeof id === "string" && !!id,
        )
      : [];
    const ens: Record<string, string> = {};
    if (parsed.walletEnsLabels && typeof parsed.walletEnsLabels === "object") {
      for (const [k, v] of Object.entries(parsed.walletEnsLabels)) {
        if (typeof v === "string" && v.trim()) {
          ens[k.trim().toLowerCase()] = v.trim().toLowerCase();
        }
      }
    }
    return {
      v: 1,
      linkedWallets: [...new Set(wallets)],
      walletEnsLabels: ens,
      linkedExchanges: [...new Set(exchanges)],
    };
  } catch {
    return null;
  }
}

function writeStoredLinks(data: StoredLinks) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Recover link badges from ledger txs when storage was never written. */
function linksFromTxs(txs: CryptoTx[]): {
  wallets: string[];
  exchanges: string[];
} {
  const wallets = new Set<string>();
  const exchanges = new Set<string>();
  for (const t of txs) {
    if (t.source === "wallet" && t.walletAddress) {
      const a = t.walletAddress.trim().toLowerCase();
      if (a) wallets.add(a);
    }
    if (t.source === "exchange" && t.exchange) {
      const id = resolveExchangeLinkId(t.exchange);
      if (id) exchanges.add(id);
    }
  }
  return { wallets: [...wallets], exchanges: [...exchanges] };
}

/**
 * True when a ledger row belongs to the wallet being unlinked.
 * Prefers `walletAddress` (stamped on sync). Falls back to address substrings
 * in common fields for legacy rows; optionally drops unstamped `source:wallet`
 * rows when this is the last linked wallet.
 */
function walletTxMatchesAddress(
  t: CryptoTx,
  address: string,
  opts: { clearUnstampedWalletSource: boolean },
): boolean {
  const target = address.trim().toLowerCase();
  if (!target) return false;

  const stamped = t.walletAddress?.trim().toLowerCase();
  if (stamped && stamped === target) return true;

  const haystacks = [t.id, t.note, t.txHash].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  for (const h of haystacks) {
    if (h.toLowerCase().includes(target)) return true;
  }

  if (
    opts.clearUnstampedWalletSource &&
    t.source === "wallet" &&
    !stamped
  ) {
    return true;
  }

  return false;
}

interface PortfolioState {
  txs: CryptoTx[];
  year: number;
  otherIncomeJpy: number;
  incomeProvided: boolean;
  taxYears: YearCarryRow[];
  connectedWallet?: string;
  linkedWallets: string[];
  /** Lowercase 0x address → ENS label when the user connected via ENS. */
  walletEnsLabels: Record<string, string>;
  linkedExchanges: string[];
  availableYears: number[];
  addTxs: (incoming: CryptoTx[]) => void;
  clearTxs: () => void;
  setYear: (y: number) => void;
  setOtherIncomeJpy: (n: number) => void;
  setConnectedWallet: (a?: string) => void;
  markWalletLinked: (address: string, ens?: string) => void;
  unlinkWallet: (address: string) => void;
  markExchangeLinked: (id: string) => void;
  unlinkExchange: (id: string) => void;
  updateTx: (id: string, patch: Partial<CryptoTx>) => void;
  removeTx: (id: string) => void;
  toggleExclude: (id: string) => void;
  hydrateFromServer: (data: {
    txs: CryptoTx[];
    otherIncomeJpy: number;
    incomeProvided: boolean;
    year: number;
  }) => void;
  setTaxYears: (rows: YearCarryRow[]) => void;
}

const PortfolioContext = createContext<PortfolioState | null>(null);

function dedupeKey(t: CryptoTx): string {
  return `${t.date}|${t.asset}|${t.side}|${t.quantity}|${t.jpyValue}|${t.source}|${t.exchange ?? ""}|${t.txHash ?? ""}`;
}

function recomputeLocalYears(txs: CryptoTx[]): YearCarryRow[] {
  const years = new Set<number>();
  for (const t of txs) {
    const y = Number(t.date.slice(0, 4));
    if (Number.isFinite(y)) years.add(y);
  }
  if (!years.size) return [];
  const sorted = [...years].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const nets = [];
  for (let y = min; y <= max; y++) {
    nets.push({ year: y, netGainJpy: summarizeTaxYear(txs, y).totalGainJpy });
  }
  return applyLossCarrySeries(nets);
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [txs, setTxs] = useState<CryptoTx[]>([]);
  // Prefer an unlocked year so free users don't land on a Pro paywall.
  const [year, setYear] = useState(() => filingTaxYears()[0] - 1);
  const [otherIncomeJpy, setOtherIncomeJpyState] = useState(0);
  const [incomeProvided, setIncomeProvided] = useState(false);
  const [taxYears, setTaxYears] = useState<YearCarryRow[]>([]);
  const [connectedWallet, setConnectedWallet] = useState<string>();
  const [linkedWallets, setLinkedWallets] = useState<string[]>([]);
  const [walletEnsLabels, setWalletEnsLabels] = useState<
    Record<string, string>
  >({});
  const [linkedExchanges, setLinkedExchanges] = useState<string[]>([]);
  const [linksReady, setLinksReady] = useState(false);
  /** True once localStorage had an entry (including empty arrays after unlink). */
  const hadStoredLinksRef = useRef(false);
  const seededFromTxsRef = useRef(false);

  // Restore linked accounts from localStorage (survives refresh).
  useEffect(() => {
    const stored = readStoredLinks();
    if (stored) {
      hadStoredLinksRef.current = true;
      setLinkedWallets(stored.linkedWallets);
      setWalletEnsLabels(stored.walletEnsLabels);
      setLinkedExchanges(stored.linkedExchanges);
      setConnectedWallet(
        stored.linkedWallets[stored.linkedWallets.length - 1],
      );
    }
    setLinksReady(true);
  }, []);

  // Persist link badges whenever they change.
  // Skip writing an empty placeholder before one-time seed-from-txs can run.
  useEffect(() => {
    if (!linksReady) return;
    if (
      !hadStoredLinksRef.current &&
      linkedWallets.length === 0 &&
      linkedExchanges.length === 0
    ) {
      return;
    }
    hadStoredLinksRef.current = true;
    writeStoredLinks({
      v: 1,
      linkedWallets,
      walletEnsLabels,
      linkedExchanges,
    });
  }, [linksReady, linkedWallets, walletEnsLabels, linkedExchanges]);

  // One-time recovery: if user never had stored links, rebuild badges from ledger.
  useEffect(() => {
    if (!linksReady || hadStoredLinksRef.current || seededFromTxsRef.current) {
      return;
    }
    if (!txs.length) return;
    const derived = linksFromTxs(txs);
    seededFromTxsRef.current = true;
    if (!derived.wallets.length && !derived.exchanges.length) return;
    hadStoredLinksRef.current = true;
    setLinkedWallets(derived.wallets);
    setLinkedExchanges(derived.exchanges);
    setConnectedWallet(derived.wallets[derived.wallets.length - 1]);
  }, [linksReady, txs]);

  // Continuous calendar span (min tx year → max(tx year, this calendar year))
  // so gaps like 2021–2023 stay selectable even with no txs (empty results).
  const availableYears = useMemo(() => {
    const calendarYear = new Date().getFullYear();
    let min: number | null = null;
    let max = calendarYear;
    for (const t of txs) {
      const y = Number(t.date.slice(0, 4));
      if (!Number.isFinite(y)) continue;
      if (min == null || y < min) min = y;
      if (y > max) max = y;
    }
    if (min == null) min = Math.min(year, calendarYear);
    min = Math.min(min, year);
    max = Math.max(max, year, calendarYear);
    const years: number[] = [];
    for (let y = max; y >= min; y--) years.push(y);
    return years;
  }, [txs, year]);

  const commitTxs = useCallback((next: CryptoTx[]) => {
    const collapsed = collapseWraps(matchTransfers(next).txs);
    setTxs(collapsed);
    setTaxYears(recomputeLocalYears(collapsed));
  }, []);

  const addTxs = useCallback(
    (incoming: CryptoTx[]) => {
      setTxs((prev) => {
        const keys = new Set(prev.map(dedupeKey));
        const fresh = incoming.filter((t) => !keys.has(dedupeKey(t)));
        const merged = [...prev, ...fresh].sort((a, b) =>
          a.date.localeCompare(b.date),
        );
        const collapsed = collapseWraps(matchTransfers(merged).txs);
        setTaxYears(recomputeLocalYears(collapsed));
        return collapsed;
      });
    },
    [],
  );

  const clearTxs = useCallback(() => {
    setTxs([]);
    setTaxYears([]);
    setConnectedWallet(undefined);
    setLinkedWallets([]);
    setWalletEnsLabels({});
    setLinkedExchanges([]);
    hadStoredLinksRef.current = true;
    writeStoredLinks({
      v: 1,
      linkedWallets: [],
      walletEnsLabels: {},
      linkedExchanges: [],
    });
  }, []);

  const setOtherIncomeJpy = useCallback((n: number) => {
    setOtherIncomeJpyState(Math.max(0, n));
    setIncomeProvided(true);
  }, []);

  /** Add/update one wallet link — never wipes other linked wallets. */
  const markWalletLinked = useCallback((address: string, ens?: string) => {
    const a = address.trim().toLowerCase();
    if (!a) return;
    setLinkedWallets((prev) => (prev.includes(a) ? prev : [...prev, a]));
    setConnectedWallet(a);
    const label = ens?.trim().toLowerCase();
    if (label) {
      setWalletEnsLabels((prev) => ({ ...prev, [a]: label }));
    }
  }, []);

  /** Unlink wallet badge and remove that wallet’s imported ledger rows. */
  const unlinkWallet = useCallback(
    (address: string) => {
      const target = address.trim().toLowerCase();
      if (!target) return;
      const remaining = linkedWallets.filter(
        (a) => a.toLowerCase() !== target,
      );
      const clearUnstampedWalletSource = remaining.length === 0;
      setLinkedWallets(remaining);
      setConnectedWallet(remaining[remaining.length - 1]);
      setWalletEnsLabels((prev) => {
        if (!(target in prev)) return prev;
        const next = { ...prev };
        delete next[target];
        return next;
      });
      setTxs((prev) => {
        const filtered = prev.filter(
          (t) =>
            !walletTxMatchesAddress(t, target, {
              clearUnstampedWalletSource,
            }),
        );
        if (filtered.length === prev.length) return prev;
        const collapsed = collapseWraps(matchTransfers(filtered).txs);
        setTaxYears(recomputeLocalYears(collapsed));
        return collapsed;
      });
    },
    [linkedWallets],
  );

  /** Add/update one exchange link — never wipes other linked exchanges. */
  const markExchangeLinked = useCallback((id: string) => {
    setLinkedExchanges((prev) =>
      prev.includes(id) ? prev : [...prev, id],
    );
  }, []);

  /** Clear link badge only — ledger / tax calc stays untouched. */
  const unlinkExchange = useCallback((id: string) => {
    setLinkedExchanges((prev) => prev.filter((x) => x !== id));
  }, []);

  const updateTx = useCallback(
    (id: string, patch: Partial<CryptoTx>) => {
      setTxs((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
        const collapsed = collapseWraps(matchTransfers(next).txs);
        setTaxYears(recomputeLocalYears(collapsed));
        return collapsed;
      });
    },
    [],
  );

  const removeTx = useCallback((id: string) => {
    setTxs((prev) => {
      const collapsed = collapseWraps(
        matchTransfers(prev.filter((t) => t.id !== id)).txs,
      );
      setTaxYears(recomputeLocalYears(collapsed));
      return collapsed;
    });
  }, []);

  const toggleExclude = useCallback((id: string) => {
    setTxs((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, excluded: !t.excluded } : t,
      );
      const collapsed = collapseWraps(matchTransfers(next).txs);
      setTaxYears(recomputeLocalYears(collapsed));
      return collapsed;
    });
  }, []);

  const hydrateFromServer = useCallback(
    (data: {
      txs: CryptoTx[];
      otherIncomeJpy: number;
      incomeProvided: boolean;
      year: number;
    }) => {
      commitTxs(data.txs);
      setOtherIncomeJpyState(data.otherIncomeJpy);
      setIncomeProvided(data.incomeProvided);
      setYear(data.year);
    },
    [commitTxs],
  );

  const value = useMemo(
    () => ({
      txs,
      year,
      otherIncomeJpy,
      incomeProvided,
      taxYears,
      connectedWallet,
      linkedWallets,
      walletEnsLabels,
      linkedExchanges,
      availableYears,
      addTxs,
      clearTxs,
      setYear,
      setOtherIncomeJpy,
      setConnectedWallet,
      markWalletLinked,
      unlinkWallet,
      markExchangeLinked,
      unlinkExchange,
      updateTx,
      removeTx,
      toggleExclude,
      hydrateFromServer,
      setTaxYears,
    }),
    [
      txs,
      year,
      otherIncomeJpy,
      incomeProvided,
      taxYears,
      connectedWallet,
      linkedWallets,
      walletEnsLabels,
      linkedExchanges,
      availableYears,
      addTxs,
      clearTxs,
      setOtherIncomeJpy,
      markWalletLinked,
      unlinkWallet,
      markExchangeLinked,
      unlinkExchange,
      updateTx,
      removeTx,
      toggleExclude,
      hydrateFromServer,
    ],
  );

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within PortfolioProvider");
  return ctx;
}

export function useTaxSummary() {
  const { txs, year, otherIncomeJpy, incomeProvided, taxYears } = usePortfolio();
  const summary = useMemo(() => summarizeTaxYear(txs, year), [txs, year]);
  const yearCarry = useMemo(
    () => taxYears.find((t) => t.year === year),
    [taxYears, year],
  );
  const gainForEstimate =
    yearCarry?.taxableAfterCarryJpy ?? summary.totalGainJpy;
  const estimate = useMemo(
    () =>
      estimateJapanTax(gainForEstimate, otherIncomeJpy, {
        incomeProvided,
      }),
    [gainForEstimate, otherIncomeJpy, incomeProvided],
  );
  const matches = useMemo(
    () => matchTransfers(txs.filter((t) => !t.excluded)).matches,
    [txs],
  );
  return { summary, estimate, matches, yearCarry };
}
