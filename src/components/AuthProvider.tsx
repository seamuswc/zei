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
import { usePortfolio } from "./PortfolioProvider";
import { PayUsdcModal, type UsdcInvoiceClient } from "./PayUsdcModal";

export type AuthUser = {
  id: string;
  email: string;
  plan: "free" | "pro";
  planExpiresAt: string | null;
  emailVerified: boolean;
};

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  isPro: boolean;
  refreshMe: () => Promise<void>;
  startProPay: () => Promise<void>;
  /** Ends session and wipes local portfolio (cloud data stays on the account). */
  logout: () => Promise<void>;
  /** Session only — does not wipe portfolio (use `logout` for that). */
  setUser: (u: AuthUser | null) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

const AUTOSAVE_MS = 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    hydrateFromServer,
    setTaxYears,
    clearLocalPortfolio,
    txs,
    otherIncomeJpy,
    incomeProvided,
    year,
    ledgerReady,
  } = usePortfolio();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<UsdcInvoiceClient | null>(null);
  /** Skip autosave right after hydrate / login so we don't overwrite or echo. */
  const skipSaveRef = useRef(true);
  const txsRef = useRef(txs);
  txsRef.current = txs;

  const refreshMe = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const data = (await res.json()) as {
      user: AuthUser | null;
      ledger?: {
        txs: CryptoTx[];
        otherIncomeJpy: number;
        incomeProvided: boolean;
        year: number;
      };
      taxYears?: YearCarryRow[];
    };
    // Session probe only — do not wipe local portfolio on null user (refresh / expired cookie).
    // Explicit logout calls clearLocalPortfolio separately.
    setUser(data.user);

    const serverTxs = data.ledger?.txs;
    const serverHasTxs = Array.isArray(serverTxs) && serverTxs.length > 0;
    const localHasTxs = txsRef.current.length > 0;

    if (serverHasTxs && data.ledger) {
      skipSaveRef.current = true;
      if (localHasTxs) {
        // Union by id — do not blindly replace local edits.
        hydrateFromServer({ ...data.ledger, mergeWithLocal: true });
      } else {
        hydrateFromServer(data.ledger);
      }
    } else if (localHasTxs) {
      // Empty/missing cloud ledger must not wipe local imports (or flash-empty).
      skipSaveRef.current = false;
    } else {
      skipSaveRef.current = false;
    }

    if (data.taxYears?.length) setTaxYears(data.taxYears);
    setLoading(false);
  }, [hydrateFromServer, setTaxYears]);

  // Wait for localStorage restore so merge policy sees real local txs.
  useEffect(() => {
    if (!ledgerReady) return;
    void refreshMe();
  }, [ledgerReady, refreshMe]);

  useEffect(() => {
    if (loading || !user?.emailVerified) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      void fetch("/api/ledger", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txs,
          otherIncomeJpy,
          incomeProvided,
          year,
        }),
      });
    }, AUTOSAVE_MS);

    return () => window.clearTimeout(timer);
  }, [txs, otherIncomeJpy, incomeProvided, year, user, loading]);

  const startProPay = useCallback(async () => {
    const res = await fetch("/api/pay/create", { method: "POST" });
    const data = (await res.json()) as UsdcInvoiceClient & { error?: string };
    if (!res.ok) throw new Error(data.error || "Payment failed");
    setInvoice({
      paymentId: data.paymentId,
      address: data.address,
      amountUsdc: data.amountUsdc,
      amountRaw: data.amountRaw,
      fromAddress: data.fromAddress ?? null,
      chains: data.chains,
      allowDevConfirm: data.allowDevConfirm,
    });
  }, []);

  const logout = useCallback(async () => {
    // Drop session first so autosave cannot PUT an emptied ledger to the cloud.
    skipSaveRef.current = true;
    setUser(null);
    clearLocalPortfolio();
    await fetch("/api/auth/logout", { method: "POST" });
  }, [clearLocalPortfolio]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isPro: user?.plan === "pro",
      refreshMe,
      startProPay,
      logout,
      setUser,
    }),
    [user, loading, refreshMe, startProPay, logout],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {invoice && (
        <PayUsdcModal
          invoice={invoice}
          onClose={() => setInvoice(null)}
          onPaid={() => {
            void refreshMe();
            setTimeout(() => setInvoice(null), 1800);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
