"use client";

import { useState } from "react";
import type { CryptoTx } from "@/lib/tax/types";
import {
  isEnsName,
  isEthHexAddress,
  normalizeWalletInput,
} from "@/lib/ens-format";
import { shortAddr } from "@/lib/browser-wallet";
import { usePortfolio } from "./PortfolioProvider";
import { useI18n } from "./I18nProvider";

async function readJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (/<html/i.test(text)) {
      throw new Error(
        res.status === 504 || res.status === 502
          ? "Wallet sync timed out. Wait a moment and try again."
          : "Wallet sync failed (server returned an error page).",
      );
    }
    throw new Error(text.slice(0, 160) || `Wallet sync failed (${res.status})`);
  }
}

function looksLikeEnsAttempt(raw: string): boolean {
  const n = normalizeWalletInput(raw);
  return n.includes(".") || n.endsWith(".eth");
}

export function WalletConnect() {
  const {
    addTxs,
    markWalletLinked,
    linkedWallets,
    walletEnsLabels,
    unlinkWallet,
  } = usePortfolio();
  const { t } = useI18n();
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [resolvedLine, setResolvedLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onConnect() {
    if (busy) return;
    const addr = normalizeWalletInput(address);
    if (!addr) return;

    // Client-side ENS shape check (server still resolves / re-validates).
    if (looksLikeEnsAttempt(addr) && !isEnsName(addr) && !isEthHexAddress(addr)) {
      setError(t("wallet_ens_invalid"));
      setStatus(null);
      setResolvedLine(null);
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);
    setResolvedLine(null);
    try {
      const res = await fetch("/api/wallet/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: addr,
          // Include already-linked wallets so counterparty hops classify as transfers
          linkedAddresses: linkedWallets,
        }),
      });
      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Wallet sync failed",
        );
      }
      const txs = (data.txs as CryptoTx[] | undefined) ?? [];
      const syncedAddress =
        typeof data.address === "string" ? data.address : addr;
      const ens =
        typeof data.ens === "string" && data.ens ? data.ens : undefined;
      addTxs(txs);
      markWalletLinked(syncedAddress, ens);
      if (ens) {
        setResolvedLine(
          t("wallet_resolved", { ens, address: syncedAddress }),
        );
      }
      setStatus(
        t("wallet_sync_ok", {
          chain: String(data.chain ?? ""),
          n: Number(data.count ?? txs.length),
        }),
      );
      setAddress("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet sync failed");
    } finally {
      setBusy(false);
    }
  }

  const busyLabel = looksLikeEnsAttempt(address)
    ? t("wallet_resolving")
    : t("wallet_syncing");
  const busyBanner = looksLikeEnsAttempt(address)
    ? t("wallet_resolving")
    : t("wallet_sync_wait");

  return (
    <div className={`import-panel${busy ? " import-panel--busy" : ""}`}>
      <div className="import-panel__head">
        <p className="import-kicker">{t("wallet_kicker")}</p>
        <h3>{t("wallet_title")}</h3>
        <p>{t("wallet_desc")}</p>
      </div>

      <label className="field">
        <span>{t("wallet_address")}</span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x… or vitalik.eth"
          spellCheck={false}
          autoComplete="off"
          disabled={busy}
        />
      </label>

      <div className="import-actions">
        <button
          type="button"
          className="btn btn--solid"
          disabled={busy || !address.trim()}
          onClick={() => void onConnect()}
        >
          {busy ? (
            <span className="btn-loading">
              <span className="spinner" aria-hidden />
              {busyLabel}
            </span>
          ) : (
            t("wallet_sync")
          )}
        </button>
      </div>

      {busy && (
        <p className="wallet-sync-banner" role="status" aria-live="polite">
          <span className="spinner" aria-hidden />
          {busyBanner}
        </p>
      )}

      <p className="field-hint">{t("wallet_hint")}</p>
      {resolvedLine && <p className="status-ok">{resolvedLine}</p>}
      {status && <p className="status-ok">{status}</p>}
      {error && <p className="status-err-line">{error}</p>}

      {linkedWallets.length > 0 && (
        <ul className="link-list" aria-label={t("wallet_linked_list")}>
          {linkedWallets.map((w) => {
            const ens = walletEnsLabels[w.toLowerCase()];
            const label = ens
              ? t("wallet_linked_ens", {
                  ens,
                  address: shortAddr(w),
                })
              : t("wallet_linked", { address: shortAddr(w) });
            return (
              <li key={w} className="link-list__row">
                <span>{label}</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    unlinkWallet(w);
                    setStatus(t("unlink_kept_txs"));
                    setError(null);
                    setResolvedLine(null);
                  }}
                  disabled={busy}
                >
                  {t("unlink")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
