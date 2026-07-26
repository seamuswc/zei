"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "./I18nProvider";

export type UsdcInvoiceClient = {
  paymentId: string;
  address: string;
  amountUsdc: string;
  ref: string;
  qrDataUrl: string;
  eip681?: string;
  chains: Array<{ id: number; name: string }>;
  allowDevConfirm?: boolean;
};

type Props = {
  invoice: UsdcInvoiceClient;
  onClose: () => void;
  onPaid: () => void;
};

const AUTO_POLL_MS = 9000;

export function PayUsdcModal({ invoice, onClose, onPaid }: Props) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<"addr" | "amt" | "ref" | null>(null);
  const busyRef = useRef(false);
  const paidRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  async function copy(text: string, kind: "addr" | "amt" | "ref") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  const check = useCallback(
    async (devConfirm = false, opts?: { quiet?: boolean }) => {
      if (busyRef.current || paidRef.current) return;
      busyRef.current = true;
      setBusy(true);
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
        setBusy(false);
      }
    },
    [invoice.paymentId, onPaid, t],
  );

  useEffect(() => {
    if (paid) return;
    const id = window.setInterval(() => {
      void check(false, { quiet: true });
    }, AUTO_POLL_MS);
    return () => window.clearInterval(id);
  }, [check, paid]);

  if (!mounted) return null;

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

          <div className="pay-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={invoice.qrDataUrl}
              alt="USDC payment QR"
              width={240}
              height={240}
            />
          </div>
          <p className="field-hint">{t("pay_qr_hint")}</p>

          <dl className="pay-facts">
            <div>
              <dt>{t("pay_amount")}</dt>
              <dd>
                <code>{invoice.amountUsdc} USDC</code>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => void copy(invoice.amountUsdc, "amt")}
                >
                  {copied === "amt" ? t("pay_copied") : t("pay_copy")}
                </button>
              </dd>
            </div>
            <div>
              <dt>{t("pay_address")}</dt>
              <dd>
                <code className="pay-addr">{invoice.address}</code>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => void copy(invoice.address, "addr")}
                >
                  {copied === "addr" ? t("pay_copied") : t("pay_copy")}
                </button>
              </dd>
            </div>
            <div>
              <dt>{t("pay_ref")}</dt>
              <dd>
                <code>{invoice.ref}</code>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => void copy(invoice.ref, "ref")}
                >
                  {copied === "ref" ? t("pay_copied") : t("pay_copy")}
                </button>
              </dd>
            </div>
          </dl>

          <p className="field-hint">{t("pay_ref_hint")}</p>
          <p className="field-hint">
            {t("pay_chains")}:{" "}
            {invoice.chains.map((c) => c.name).join(" · ")}
          </p>
          <p className="status-warn">{t("pay_exact_warn")}</p>

          {busy && (
            <p className="pay-check-banner" role="status" aria-live="polite">
              <span className="spinner" aria-hidden />
              {t("pay_checking")}
            </p>
          )}

          <div className="import-actions">
            <button
              type="button"
              className="btn btn--solid"
              disabled={busy || paid}
              onClick={() => void check(false)}
            >
              {busy ? (
                <span className="btn-loading">
                  <span className="spinner" aria-hidden />
                  {t("pay_checking")}
                </span>
              ) : (
                t("pay_check")
              )}
            </button>
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

          {msg && <p className="status-ok">{msg}</p>}
          {err && <p className="status-err-line">{err}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
