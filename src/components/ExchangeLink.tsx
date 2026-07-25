"use client";

import { useState } from "react";
import type { CryptoTx } from "@/lib/tax/types";
import { EXCHANGES } from "@/lib/import/exchange-live";
import { usePortfolio } from "./PortfolioProvider";
import { useI18n } from "./I18nProvider";

export function ExchangeLink() {
  const { addTxs, linkedExchanges, markExchangeLinked } = usePortfolio();
  const { t } = useI18n();
  const [selected, setSelected] = useState("bitflyer");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exchange = EXCHANGES.find((e) => e.id === selected) ?? EXCHANGES[0];

  async function onLink() {
    setBusy(true);
    setStatus(null);
    setWarning(null);
    setError(null);
    try {
      const res = await fetch("/api/exchange/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchange: selected,
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        count?: number;
        txs?: CryptoTx[];
        warning?: string;
      };
      if (!res.ok) throw new Error(data.error || "Exchange sync failed");
      addTxs(data.txs ?? []);
      markExchangeLinked(selected);
      setStatus(
        t("exchange_synced", {
          name: exchange.name,
          n: data.count ?? 0,
        }),
      );
      if (data.warning) setWarning(data.warning);
      setApiKey("");
      setApiSecret("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Exchange sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="import-panel import-panel--exchange">
      <div className="import-panel__head">
        <p className="import-kicker">{t("exchange_kicker")}</p>
        <h3>{t("exchange_title")}</h3>
        <p>{t("exchange_desc")}</p>
      </div>

      <aside className="readonly-banner" role="note">
        <strong>{t("exchange_readonly_title")}</strong>
        <p>{t("exchange_readonly_body")}</p>
      </aside>

      <label className="field">
        <span>{t("exchange_label")}</span>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {EXCHANGES.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name} · {t("region_japan")}
            </option>
          ))}
        </select>
      </label>

      <div className="exchange-guide">
        <p className="field-hint">{t(exchange.permKey)}</p>
        {exchange.historyNoteKey && (
          <p className="status-warn">{t(exchange.historyNoteKey)}</p>
        )}
        <a
          className="exchange-docs"
          href={exchange.docsUrl}
          target="_blank"
          rel="noreferrer"
        >
          {t("exchange_docs")} ↗
        </a>
      </div>

      <label className="field">
        <span>{t("exchange_key")}</span>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder="read-only"
        />
      </label>
      <label className="field">
        <span>{t("exchange_secret")}</span>
        <input
          type="password"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </label>

      <div className="import-actions">
        <button
          type="button"
          className="btn btn--solid"
          disabled={
            busy ||
            !apiKey.trim() ||
            !apiSecret.trim() ||
            linkedExchanges.includes(selected)
          }
          onClick={() => void onLink()}
        >
          {busy
            ? t("exchange_syncing")
            : linkedExchanges.includes(selected)
              ? t("exchange_linked")
              : t("exchange_connect")}
        </button>
      </div>

      <p className="field-hint">{t("exchange_csv_alt")}</p>

      {status && <p className="status-ok">{status}</p>}
      {warning && <p className="status-warn">{warning}</p>}
      {error && <p className="status-err-line">{error}</p>}
    </div>
  );
}
