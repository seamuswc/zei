"use client";

import { useEffect, useState } from "react";
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

export function PayUsdcModal({ invoice, onClose, onPaid }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<"addr" | "amt" | "ref" | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  async function check(devConfirm = false) {
    setBusy(true);
    setMsg(null);
    setErr(null);
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
        setMsg(
          t("pay_confirmed", {
            chain: data.chain || "",
            tx: (data.txHash || "").slice(0, 18),
          }),
        );
        onPaid();
      } else {
        setErr(data.message || t("pay_waiting"));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Check failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="pay-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
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
              alt="USDC payment address QR"
              width={240}
              height={240}
            />
          </div>

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

          <div className="import-actions">
            <button
              type="button"
              className="btn btn--solid"
              disabled={busy}
              onClick={() => void check(false)}
            >
              {busy ? t("pay_checking") : t("pay_check")}
            </button>
            {invoice.allowDevConfirm && (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
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
    </div>
  );
}
