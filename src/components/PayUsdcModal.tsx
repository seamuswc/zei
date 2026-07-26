"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  connectWallet,
  getInjectedProvider,
  sendUsdcTransfer,
  shortAddr,
  type PayChainClient,
} from "@/lib/browser-wallet";
import { useI18n } from "./I18nProvider";

export type UsdcInvoiceClient = {
  paymentId: string;
  address: string;
  amountUsdc: string;
  amountRaw: string;
  fromAddress?: string | null;
  chains: PayChainClient[];
  allowDevConfirm?: boolean;
};

type Props = {
  invoice: UsdcInvoiceClient;
  onClose: () => void;
  onPaid: () => void;
};

const AUTO_POLL_MS = 8000;

function walletErrorMessage(e: unknown, noWallet: string, rejected: string): string {
  if (e instanceof Error) {
    if (e.message === "NO_WALLET" || e.message === "NO_ACCOUNT") return noWallet;
  }
  const code =
    e && typeof e === "object" && "code" in e
      ? Number((e as { code: number }).code)
      : 0;
  if (code === 4001) return rejected;
  return e instanceof Error ? e.message : "Wallet error";
}

export function PayUsdcModal({ invoice, onClose, onPaid }: Props) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [account, setAccount] = useState<string | null>(
    invoice.fromAddress?.toLowerCase() || null,
  );
  const [chainId, setChainId] = useState<number>(
    invoice.chains.find((c) => c.id === 8453)?.id ??
      invoice.chains[0]?.id ??
      8453,
  );
  const [phase, setPhase] = useState<
    "idle" | "binding" | "sending" | "confirming" | "checking"
  >("idle");
  const [paid, setPaid] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const busyRef = useRef(false);
  const paidRef = useRef(false);
  const chainIdRef = useRef(chainId);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    chainIdRef.current = chainId;
  }, [chainId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const bindWallet = useCallback(
    async (fromAddress: string) => {
      setPhase("binding");
      setErr(null);
      try {
        const res = await fetch("/api/pay/bind", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId: invoice.paymentId,
            fromAddress,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          fromAddress?: string;
        };
        if (!res.ok) throw new Error(data.error || t("pay_bind_failed"));
        setAccount((data.fromAddress || fromAddress).toLowerCase());
      } finally {
        setPhase("idle");
      }
    },
    [invoice.paymentId, t],
  );

  const onConnect = useCallback(async () => {
    setErr(null);
    setMsg(null);
    try {
      const addr = await connectWallet();
      await bindWallet(addr);
    } catch (e) {
      setErr(walletErrorMessage(e, t("pay_no_wallet"), t("pay_user_rejected")));
    }
  }, [bindWallet, t]);

  const check = useCallback(
    async (devConfirm = false, opts?: { quiet?: boolean }) => {
      if (busyRef.current || paidRef.current) return;
      busyRef.current = true;
      if (!opts?.quiet) setPhase("checking");
      if (!opts?.quiet) {
        setMsg(null);
        setErr(null);
      }
      try {
        const res = await fetch("/api/pay/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId: invoice.paymentId,
            chainId: chainIdRef.current,
            devConfirm: devConfirm || undefined,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          ok?: boolean;
          txHash?: string;
          chain?: string;
          message?: string;
        };
        if (!res.ok) throw new Error(data.error || "Check failed");
        if (data.ok) {
          paidRef.current = true;
          setPaid(true);
          setErr(null);
          setMsg(
            t("pay_confirmed", {
              chain: data.chain || "",
              tx: (data.txHash || "").slice(0, 18),
            }),
          );
          onPaid();
        } else if (!opts?.quiet) {
          setErr(data.message || t("pay_waiting"));
        }
      } catch (e) {
        if (!opts?.quiet) {
          setErr(e instanceof Error ? e.message : "Check failed");
        }
      } finally {
        busyRef.current = false;
        if (!opts?.quiet && !paidRef.current) setPhase("idle");
      }
    },
    [invoice.paymentId, onPaid, t],
  );

  const onPay = useCallback(async () => {
    if (!account || paidRef.current) return;
    const chain = invoice.chains.find((c) => c.id === chainId);
    if (!chain) return;
    setErr(null);
    setMsg(null);
    setPhase("sending");
    try {
      const hash = await sendUsdcTransfer({
        from: account,
        to: invoice.address,
        usdc: chain.usdc,
        amountRaw: BigInt(invoice.amountRaw),
        chainId: chain.id,
      });
      setTxHash(hash);
      setMsg(
        t("pay_tx_submitted", {
          tx: `${hash.slice(0, 10)}…`,
        }),
      );
      setPhase("confirming");
      // Poll a few times quickly after broadcast
      for (let i = 0; i < 8 && !paidRef.current; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 2500 : 4000));
        await check(false, { quiet: true });
        if (paidRef.current) return;
      }
      if (!paidRef.current) {
        setPhase("idle");
        setErr(t("pay_waiting"));
      }
    } catch (e) {
      setPhase("idle");
      setErr(walletErrorMessage(e, t("pay_no_wallet"), t("pay_user_rejected")));
    }
  }, [account, chainId, check, invoice, t]);

  useEffect(() => {
    if (paid) return;
    const id = window.setInterval(() => {
      if (!account) return;
      void check(false, { quiet: true });
    }, AUTO_POLL_MS);
    return () => window.clearInterval(id);
  }, [account, check, paid]);

  useEffect(() => {
    const eth = getInjectedProvider();
    if (!eth?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      const next = (accounts?.[0] || "").toLowerCase();
      if (!next) {
        setAccount(null);
        return;
      }
      void bindWallet(next).catch((e) => {
        setErr(
          walletErrorMessage(e, t("pay_no_wallet"), t("pay_user_rejected")),
        );
      });
    };
    const onChain = (...args: unknown[]) => {
      const hex = args[0] as string | undefined;
      if (!hex) return;
      const id = Number.parseInt(hex, 16);
      if (invoice.chains.some((c) => c.id === id)) setChainId(id);
    };
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [bindWallet, invoice.chains, t]);

  if (!mounted) return null;

  const busy = phase !== "idle";
  const hasInjected = !!getInjectedProvider();

  return createPortal(
    <div
      className="pay-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-title"
    >
      <button
        type="button"
        className="pay-modal__backdrop"
        aria-label={t("pay_close")}
        onClick={onClose}
      />
      <div className="pay-sheet">
        <header className="pay-sheet__head">
          <div>
            <p className="import-kicker">ZEI Pro</p>
            <h2 id="pay-title">{t("pay_title")}</h2>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onClose}
          >
            {t("pay_close")}
          </button>
        </header>

        <div className="pay-sheet__body">
          <p className="pay-lead">{t("pay_lead")}</p>

          <ol className="pay-steps" aria-label={t("pay_steps_title")}>
            <li>{t("pay_step1")}</li>
            <li>{t("pay_step2")}</li>
            <li>{t("pay_step3")}</li>
          </ol>

          <dl className="pay-facts">
            <div>
              <dt>{t("pay_price")}</dt>
              <dd>
                <strong className="pay-price">
                  {invoice.amountUsdc} USDC
                </strong>
              </dd>
            </div>
            <div>
              <dt>{t("pay_wallet")}</dt>
              <dd>
                {account ? (
                  <span className="pay-wallet-row">
                    <code>
                      {t("pay_connected", { addr: shortAddr(account) })}
                    </code>
                    <button
                      type="button"
                      className="linkish"
                      disabled={busy || paid}
                      onClick={() => setAccount(null)}
                    >
                      {t("pay_disconnect")}
                    </button>
                  </span>
                ) : (
                  <span className="field-hint">—</span>
                )}
              </dd>
            </div>
          </dl>

          {!account && (
            <>
              <button
                type="button"
                className="btn btn--solid"
                disabled={busy || paid}
                onClick={() => void onConnect()}
              >
                {phase === "binding" ? (
                  <span className="btn-loading">
                    <span className="spinner" aria-hidden />
                    {t("pay_connect")}
                  </span>
                ) : (
                  t("pay_connect")
                )}
              </button>
              {!hasInjected && (
                <p className="status-warn">{t("pay_no_wallet")}</p>
              )}
              <p className="field-hint">{t("pay_mobile_hint")}</p>
            </>
          )}

          {account && !paid && (
            <>
              <label className="pay-chain">
                <span className="pay-chain__label">{t("pay_select_chain")}</span>
                <select
                  value={chainId}
                  disabled={busy}
                  onChange={(e) => setChainId(Number(e.target.value))}
                >
                  {invoice.chains.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="btn btn--solid"
                disabled={busy}
                onClick={() => void onPay()}
              >
                {phase === "sending" || phase === "confirming" ? (
                  <span className="btn-loading">
                    <span className="spinner" aria-hidden />
                    {phase === "sending"
                      ? t("pay_sending")
                      : t("pay_confirming")}
                  </span>
                ) : (
                  t("pay_send", { amount: invoice.amountUsdc })
                )}
              </button>
            </>
          )}

          {(phase === "confirming" || phase === "checking") && (
            <p className="pay-check-banner" role="status" aria-live="polite">
              <span className="spinner" aria-hidden />
              {phase === "checking" ? t("pay_checking") : t("pay_confirming")}
            </p>
          )}

          <p className="field-hint">
            {t("pay_chains")}:{" "}
            {invoice.chains.map((c) => c.name).join(" · ")}
          </p>

          <div className="import-actions">
            {account && (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy || paid}
                onClick={() => void check(false)}
              >
                {phase === "checking" ? (
                  <span className="btn-loading">
                    <span className="spinner" aria-hidden />
                    {t("pay_checking")}
                  </span>
                ) : (
                  t("pay_check")
                )}
              </button>
            )}
            {invoice.allowDevConfirm && (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy || paid}
                onClick={() => void check(true)}
              >
                {t("pay_dev_confirm")}
              </button>
            )}
          </div>

          {txHash && !paid && (
            <p className="field-hint">
              {t("pay_tx_submitted", { tx: `${txHash.slice(0, 12)}…` })}
            </p>
          )}
          {msg && <p className="status-ok">{msg}</p>}
          {err && <p className="status-err-line">{err}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
