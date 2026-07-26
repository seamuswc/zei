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
import { filingTaxYear } from "@/lib/billing";

interface PortfolioState {
  txs: CryptoTx[];
  year: number;
  otherIncomeJpy: number;
  incomeProvided: boolean;
  taxYears: YearCarryRow[];
  connectedWallet?: string;
  linkedWallets: string[];
  linkedExchanges: string[];
  availableYears: number[];
  addTxs: (incoming: CryptoTx[]) => void;
  clearTxs: () => void;
  setYear: (y: number) => void;
  setOtherIncomeJpy: (n: number) => void;
  setConnectedWallet: (a?: string) => void;
  markWalletLinked: (address: string) => void;
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
  // Prefer a non-filing year so free users land on an unlocked year.
  const [year, setYear] = useState(() => filingTaxYear() - 1);
  const [otherIncomeJpy, setOtherIncomeJpyState] = useState(0);
  const [incomeProvided, setIncomeProvided] = useState(false);
  const [taxYears, setTaxYears] = useState<YearCarryRow[]>([]);
  const [connectedWallet, setConnectedWallet] = useState<string>();
  const [linkedWallets, setLinkedWallets] = useState<string[]>([]);
  const [linkedExchanges, setLinkedExchanges] = useState<string[]>([]);

  const availableYears = useMemo(() => {
    const years = new Set<number>([2024, 2025, 2026]);
    for (const t of txs) {
      const y = Number(t.date.slice(0, 4));
      if (Number.isFinite(y)) years.add(y);
    }
    years.add(year);
    return [...years].sort((a, b) => b - a);
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
    setLinkedExchanges([]);
  }, []);

  const setOtherIncomeJpy = useCallback((n: number) => {
    setOtherIncomeJpyState(Math.max(0, n));
    setIncomeProvided(true);
  }, []);

  const markWalletLinked = useCallback((address: string) => {
    const a = address.trim();
    if (!a) return;
    setLinkedWallets((prev) => (prev.includes(a) ? prev : [...prev, a]));
    setConnectedWallet(a);
  }, []);

  /** Clear link badge only — ledger / tax calc stays untouched. */
  const unlinkWallet = useCallback((address: string) => {
    const target = address.trim().toLowerCase();
    setLinkedWallets((prev) => {
      const next = prev.filter((a) => a.toLowerCase() !== target);
      setConnectedWallet(next[next.length - 1]);
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
