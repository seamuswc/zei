"use client";

import { useState } from "react";
import type { CryptoTx } from "@/lib/tax/types";
import { usePortfolio } from "./PortfolioProvider";
import { useI18n } from "./I18nProvider";

export function WalletConnect() {
  const { addTxs, connectedWallet, setConnectedWallet } = usePortfolio();
  const { t } = useI18n();
  const [address, setAddress] = useState("");
  const [etherscanKey, setEtherscanKey] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onConnect() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/wallet/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          etherscanApiKey: etherscanKey.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        address?: string;
        chain?: string;
        count?: number;
        txs?: CryptoTx[];
      };
      if (!res.ok) throw new Error(data.error || "Wallet sync failed");
      addTxs(data.txs ?? []);
      setConnectedWallet(data.address);
      setStatus(
        `Live · ${data.chain} · ${data.count ?? 0}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet sync failed");
    } finally {
      setBusy(false);
    }
  }

  const needsEthKey = address.trim().startsWith("0x");

  return (
    <div className="import-panel">
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
          placeholder="0x… or bc1…"
          spellCheck={false}
          autoComplete="off"
        />
      </label>

      {needsEthKey && (
        <label className="field">
          <span>{t("wallet_etherscan")}</span>
          <input
            value={etherscanKey}
            onChange={(e) => setEtherscanKey(e.target.value)}
            placeholder={t("wallet_etherscan_ph")}
            spellCheck={false}
            autoComplete="off"
          />
        </label>
      )}

      <div className="import-actions">
        <button
          type="button"
          className="btn btn--solid"
          disabled={busy || !address.trim()}
          onClick={() => void onConnect()}
        >
          {busy ? t("wallet_syncing") : t("wallet_sync")}
        </button>
      </div>

      {needsEthKey && !etherscanKey.trim() && (
        <p className="field-hint">{t("wallet_hint")}</p>
      )}
      {connectedWallet && (
        <p className="status-meta">
          {t("wallet_linked", { address: connectedWallet })}
        </p>
      )}
      {status && <p className="status-ok">{status}</p>}
      {error && <p className="status-err-line">{error}</p>}
    </div>
  );
}
