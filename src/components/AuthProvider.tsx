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
  setUser: (u: AuthUser | null) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

const AUTOSAVE_MS = 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    hydrateFromServer,
    setTaxYears,
    txs,
    otherIncomeJpy,
    incomeProvided,
    year,
  } = usePortfolio();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<UsdcInvoiceClient | null>(null);
  /** Skip autosave right after hydrate / login so we don't overwrite or echo. */
  const skipSaveRef = useRef(true);

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
    setUser(data.user);
    // After hydrating server data, skip one autosave echo. If there is no
    // cloud ledger, allow the next effect to persist local (or empty) state.
    skipSaveRef.current = !!data.ledger;
    if (data.ledger) hydrateFromServer(data.ledger);
    if (data.taxYears) setTaxYears(data.taxYears);
    setLoading(false);
  }, [hydrateFromServer, setTaxYears]);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

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

  const value = useMemo(
    () => ({
      user,
      loading,
      isPro: user?.plan === "pro",
      refreshMe,
      startProPay,
      setUser,
    }),
    [user, loading, refreshMe, startProPay],
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
