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
import { mergeLedgerById } from "@/lib/ledger-merge";
import {
  exchangeTxMatchesId,
  resolveExchangeLinkId,
} from "@/lib/tax/exchange-links";

const LINKS_STORAGE_KEY = "zei_linked_accounts";
const LEDGER_STORAGE_KEY = "zei_local_ledger";
/** Earliest year shown in the year picker (Japan crypto-tax era). */
const YEAR_FLOOR = 2017;

type StoredLinks = {
  v: 1;
  linkedWallets: string[];
  walletEnsLabels: Record<string, string>;
  /** Lowercase 0x address → Etherscan V2 chain ids last synced. */
  walletChains: Record<string, number[]>;
  linkedExchanges: string[];
};

function parseWalletChains(
  raw: unknown,
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const addr = k.trim().toLowerCase();
    if (!addr || !Array.isArray(v)) continue;
    const ids = [
      ...new Set(
        v
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    ].sort((a, b) => a - b);
    if (ids.length) out[addr] = ids;
  }
  return out;
}

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
      walletChains: parseWalletChains(parsed.walletChains),
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

type StoredLedger = {
  v: 1;
  txs: CryptoTx[];
  otherIncomeJpy: number;
  incomeProvided: boolean;
  year: number;
};

function readStoredLedger(): StoredLedger | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLedger>;
    if (!Array.isArray(parsed.txs)) return null;
    const year = Number(parsed.year);
    return {
      v: 1,
      txs: parsed.txs as CryptoTx[],
      otherIncomeJpy: Math.max(0, Number(parsed.otherIncomeJpy) || 0),
      incomeProvided: !!parsed.incomeProvided,
      year: Number.isFinite(year) ? year : filingTaxYears()[0] - 1,
    };
  } catch {
    return null;
  }
}

function writeStoredLedger(data: StoredLedger) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(data));
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
    // Prefer stamped address (any source — wraps/transfers may keep the stamp).
    const stamped = t.walletAddress?.trim().toLowerCase();
    if (stamped) wallets.add(stamped);
    if (t.exchangeId) {
      const id = resolveExchangeLinkId(t.exchangeId) ?? t.exchangeId;
      exchanges.add(id);
    } else if (t.source === "exchange" && t.exchange) {
      const id = resolveExchangeLinkId(t.exchange);
      if (id) exchanges.add(id);
    }
  }
  return { wallets: [...wallets], exchanges: [...exchanges] };
}

function persistLinks(data: StoredLinks) {
  writeStoredLinks(data);
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
  /** Lowercase 0x address → Etherscan V2 chain ids used for sync. */
  walletChains: Record<string, number[]>;
  linkedExchanges: string[];
  availableYears: number[];
  addTxs: (incoming: CryptoTx[]) => void;
  clearTxs: () => void;
  setYear: (y: number) => void;
  setOtherIncomeJpy: (n: number) => void;
  setConnectedWallet: (a?: string) => void;
  markWalletLinked: (
    address: string,
    ens?: string,
    chainIds?: number[],
  ) => void;
  unlinkWallet: (address: string) => void;
  markExchangeLinked: (id: string) => void;
  unlinkExchange: (id: string) => void;
  updateTx: (id: string, patch: Partial<CryptoTx>) => void;
  updateManyTxs: (
    ids: string[],
    patch: Partial<CryptoTx> | ((tx: CryptoTx) => Partial<CryptoTx>),
  ) => void;
  removeTx: (id: string) => void;
  removeManyTxs: (ids: string[]) => void;
  toggleExclude: (id: string) => void;
  setExcludedMany: (ids: string[], excluded: boolean) => void;
  /** True once local ledger/links have been read from storage (auth may hydrate after). */
  ledgerReady: boolean;
  hydrateFromServer: (data: {
    txs: CryptoTx[];
    otherIncomeJpy: number;
    incomeProvided: boolean;
    year: number;
    mergeWithLocal?: boolean;
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
  const [walletChains, setWalletChains] = useState<Record<string, number[]>>(
    {},
  );
  const [linkedExchanges, setLinkedExchanges] = useState<string[]>([]);
  const [linksReady, setLinksReady] = useState(false);
  const [ledgerReady, setLedgerReady] = useState(false);
  /** True once localStorage had an entry (including empty arrays after unlink). */
  const hadStoredLinksRef = useRef(false);
  const seededFromTxsRef = useRef(false);
  /** Cloud hydrate already applied — don't let a late local restore overwrite it. */
  const serverHydratedRef = useRef(false);
  /** Latest link fields for synchronous persist (avoids stale closures). */
  const linksSnapshotRef = useRef({
    linkedWallets: [] as string[],
    walletEnsLabels: {} as Record<string, string>,
    walletChains: {} as Record<string, number[]>,
    linkedExchanges: [] as string[],
  });
  linksSnapshotRef.current = {
    linkedWallets,
    walletEnsLabels,
    walletChains,
    linkedExchanges,
  };

  const flushLinks = useCallback(
    (next?: {
      linkedWallets?: string[];
      walletEnsLabels?: Record<string, string>;
      walletChains?: Record<string, number[]>;
      linkedExchanges?: string[];
    }) => {
      const snap = {
        v: 1 as const,
        linkedWallets: next?.linkedWallets ?? linksSnapshotRef.current.linkedWallets,
        walletEnsLabels:
          next?.walletEnsLabels ?? linksSnapshotRef.current.walletEnsLabels,
        walletChains:
          next?.walletChains ?? linksSnapshotRef.current.walletChains,
        linkedExchanges:
          next?.linkedExchanges ?? linksSnapshotRef.current.linkedExchanges,
      };
      linksSnapshotRef.current = {
        linkedWallets: snap.linkedWallets,
        walletEnsLabels: snap.walletEnsLabels,
        walletChains: snap.walletChains,
        linkedExchanges: snap.linkedExchanges,
      };
      hadStoredLinksRef.current = true;
      persistLinks(snap);
    },
    [],
  );

  // Restore ledger + linked accounts from localStorage (survives logout/refresh).
  // Auth must wait for ledgerReady before cloud hydrate so we don't flash-empty.
  useEffect(() => {
    const storedLedger = readStoredLedger();
    if (storedLedger && !serverHydratedRef.current) {
      const collapsed = collapseWraps(matchTransfers(storedLedger.txs).txs);
      setTxs(collapsed);
      setTaxYears(recomputeLocalYears(collapsed));
      setOtherIncomeJpyState(storedLedger.otherIncomeJpy);
      setIncomeProvided(storedLedger.incomeProvided);
      setYear(storedLedger.year);
    }

    const stored = readStoredLinks();
    if (stored) {
      hadStoredLinksRef.current = true;
      setLinkedWallets(stored.linkedWallets);
      setWalletEnsLabels(stored.walletEnsLabels);
      setWalletChains(stored.walletChains);
      setLinkedExchanges(stored.linkedExchanges);
      setConnectedWallet(
        stored.linkedWallets[stored.linkedWallets.length - 1],
      );
      linksSnapshotRef.current = {
        linkedWallets: stored.linkedWallets,
        walletEnsLabels: stored.walletEnsLabels,
        walletChains: stored.walletChains,
        linkedExchanges: stored.linkedExchanges,
      };
    }
    setLinksReady(true);
    setLedgerReady(true);
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
    flushLinks({ linkedWallets, walletEnsLabels, walletChains, linkedExchanges });
  }, [
    linksReady,
    linkedWallets,
    walletEnsLabels,
    walletChains,
    linkedExchanges,
    flushLinks,
  ]);

  // Persist ledger locally so logout / refresh still shows imports.
  useEffect(() => {
    if (!ledgerReady) return;
    writeStoredLedger({
      v: 1,
      txs,
      otherIncomeJpy,
      incomeProvided,
      year,
    });
  }, [ledgerReady, txs, otherIncomeJpy, incomeProvided, year]);

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

  // Wallet badges: if state/storage is empty but the ledger still has stamped
  // wallet addresses (e.g. cloud hydrate after a poisoned empty localStorage),
  // restore the list. Safe because wallet Unlink removes that wallet’s txs.
  useEffect(() => {
    if (!linksReady || linkedWallets.length > 0 || !txs.length) return;
    const wallets = linksFromTxs(txs).wallets;
    if (!wallets.length) return;
    setLinkedWallets(wallets);
    setConnectedWallet(wallets[wallets.length - 1]);
  }, [linksReady, txs, linkedWallets.length]);

  // Continuous calendar span (min tx year → max(tx year, this calendar year))
  // so gaps like 2021–2023 stay selectable even with no txs (empty results).
  // Floor at YEAR_FLOOR so the picker does not extend into pre-crypto-tax noise.
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
    min = Math.max(YEAR_FLOOR, min);
    if (min > max) min = max;
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
    setWalletChains({});
    setLinkedExchanges([]);
    flushLinks({
      linkedWallets: [],
      walletEnsLabels: {},
      walletChains: {},
      linkedExchanges: [],
    });
    writeStoredLedger({
      v: 1,
      txs: [],
      otherIncomeJpy: 0,
      incomeProvided: false,
      year: filingTaxYears()[0] - 1,
    });
  }, [flushLinks]);

  const setOtherIncomeJpy = useCallback((n: number) => {
    setOtherIncomeJpyState(Math.max(0, n));
    setIncomeProvided(true);
  }, []);

  /** Add/update one wallet link — never wipes other linked wallets. */
  const markWalletLinked = useCallback(
    (address: string, ens?: string, chainIds?: number[]) => {
      const a = address.trim().toLowerCase();
      if (!a) return;
      const prev = linksSnapshotRef.current.linkedWallets;
      const nextWallets = prev.includes(a) ? prev : [...prev, a];
      const label = ens?.trim().toLowerCase();
      const nextEns = label
        ? { ...linksSnapshotRef.current.walletEnsLabels, [a]: label }
        : linksSnapshotRef.current.walletEnsLabels;
      let nextChains = linksSnapshotRef.current.walletChains;
      if (chainIds && chainIds.length) {
        const merged = [
          ...new Set([
            ...(nextChains[a] ?? []),
            ...chainIds.filter((n) => Number.isFinite(n) && n > 0),
          ]),
        ].sort((x, y) => x - y);
        nextChains = { ...nextChains, [a]: merged };
      }
      setLinkedWallets(nextWallets);
      setConnectedWallet(a);
      if (label) setWalletEnsLabels(nextEns);
      if (chainIds && chainIds.length) setWalletChains(nextChains);
      flushLinks({
        linkedWallets: nextWallets,
        walletEnsLabels: nextEns,
        walletChains: nextChains,
      });
    },
    [flushLinks],
  );

  /** Unlink wallet badge and remove that wallet’s imported ledger rows. */
  const unlinkWallet = useCallback(
    (address: string) => {
      const target = address.trim().toLowerCase();
      if (!target) return;
      const remaining = linkedWallets.filter(
        (a) => a.toLowerCase() !== target,
      );
      const clearUnstampedWalletSource = remaining.length === 0;
      const nextEns = { ...linksSnapshotRef.current.walletEnsLabels };
      delete nextEns[target];
      const nextChains = { ...linksSnapshotRef.current.walletChains };
      delete nextChains[target];
      setLinkedWallets(remaining);
      setConnectedWallet(remaining[remaining.length - 1]);
      setWalletEnsLabels(nextEns);
      setWalletChains(nextChains);
      flushLinks({
        linkedWallets: remaining,
        walletEnsLabels: nextEns,
        walletChains: nextChains,
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
    [linkedWallets, flushLinks],
  );

  /** Add/update one exchange link — never wipes other linked exchanges. */
  const markExchangeLinked = useCallback(
    (id: string) => {
      const prev = linksSnapshotRef.current.linkedExchanges;
      const next = prev.includes(id) ? prev : [...prev, id];
      setLinkedExchanges(next);
      flushLinks({ linkedExchanges: next });
    },
    [flushLinks],
  );

  /** Unlink exchange badge and remove that venue’s imported ledger rows. */
  const unlinkExchange = useCallback(
    (id: string) => {
      const target = id.trim().toLowerCase();
      if (!target) return;
      const remaining = linksSnapshotRef.current.linkedExchanges.filter(
        (x) => x !== id && x.toLowerCase() !== target,
      );
      const clearUnstampedExchangeSource = remaining.length === 0;
      setLinkedExchanges(remaining);
      flushLinks({ linkedExchanges: remaining });
      setTxs((prev) => {
        const filtered = prev.filter(
          (t) =>
            !exchangeTxMatchesId(t, target, {
              clearUnstampedExchangeSource,
            }),
        );
        if (filtered.length === prev.length) return prev;
        const collapsed = collapseWraps(matchTransfers(filtered).txs);
        setTaxYears(recomputeLocalYears(collapsed));
        return collapsed;
      });
    },
    [flushLinks],
  );

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

  const updateManyTxs = useCallback(
    (
      ids: string[],
      patch: Partial<CryptoTx> | ((tx: CryptoTx) => Partial<CryptoTx>),
    ) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setTxs((prev) => {
        const next = prev.map((t) => {
          if (!idSet.has(t.id)) return t;
          const p = typeof patch === "function" ? patch(t) : patch;
          return { ...t, ...p };
        });
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

  const removeManyTxs = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setTxs((prev) => {
      const collapsed = collapseWraps(
        matchTransfers(prev.filter((t) => !idSet.has(t.id))).txs,
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

  const setExcludedMany = useCallback((ids: string[], excluded: boolean) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setTxs((prev) => {
      const next = prev.map((t) =>
        idSet.has(t.id) ? { ...t, excluded } : t,
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
      /** When set, merge with current local txs instead of replacing. */
      mergeWithLocal?: boolean;
    }) => {
      serverHydratedRef.current = true;
      if (data.mergeWithLocal) {
        setTxs((prev) => {
          const merged = mergeLedgerById(prev, data.txs);
          const collapsed = collapseWraps(matchTransfers(merged).txs);
          setTaxYears(recomputeLocalYears(collapsed));
          return collapsed;
        });
      } else {
        commitTxs(data.txs);
      }
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
      walletChains,
      linkedExchanges,
      availableYears,
      ledgerReady,
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
      updateManyTxs,
      removeTx,
      removeManyTxs,
      toggleExclude,
      setExcludedMany,
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
      walletChains,
      linkedExchanges,
      availableYears,
      ledgerReady,
      addTxs,
      clearTxs,
      setOtherIncomeJpy,
      markWalletLinked,
      unlinkWallet,
      markExchangeLinked,
      unlinkExchange,
      updateTx,
      updateManyTxs,
      removeTx,
      removeManyTxs,
      toggleExclude,
      setExcludedMany,
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
