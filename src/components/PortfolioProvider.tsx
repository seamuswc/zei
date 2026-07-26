"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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
  }, []);

  const setOtherIncomeJpy = useCallback((n: number) => {
    setOtherIncomeJpyState(Math.max(0, n));
    setIncomeProvided(true);
  }, []);

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

  /** Clear link badge only — ledger / tax calc stays untouched. */
  const unlinkWallet = useCallback((address: string) => {
    const target = address.trim().toLowerCase();
    setLinkedWallets((prev) => {
      const next = prev.filter((a) => a.toLowerCase() !== target);
      setConnectedWallet(next[next.length - 1]);
      return next;
    });
    setWalletEnsLabels((prev) => {
      if (!(target in prev)) return prev;
      const next = { ...prev };
      delete next[target];
      return next;
    });
  }, []);

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
