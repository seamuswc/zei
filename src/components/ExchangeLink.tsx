"use client";

import { useState } from "react";
import type { CryptoTx } from "@/lib/tax/types";
import { EXCHANGES } from "@/lib/import/exchange-live";
import { usePortfolio } from "./PortfolioProvider";

export function ExchangeLink() {
  const { addTxs, linkedExchanges, markExchangeLinked } = usePortfolio();
  const [selected, setSelected] = useState("bitflyer");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exchange = EXCHANGES.find((e) => e.id === selected) ?? EXCHANGES[0];

  async function onLink() {
    setBusy(true);
    setStatus(null);
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
      };
      if (!res.ok) throw new Error(data.error || "Exchange sync failed");
      addTxs(data.txs ?? []);
      markExchangeLinked(selected);
      setStatus(
        `Live linked ${exchange.name} · ${data.count ?? 0} fills imported.`,
      );
      setApiSecret("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Exchange sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="import-panel">
      <div className="import-panel__head">
        <p className="import-kicker">03 · Exchange · live</p>
        <h3>Link exchange</h3>
        <p>
          Live APIs for bitFlyer, Coincheck, GMO Coin, bitbank, Binance JP.
          Use read-only keys. Secrets are not stored.
        </p>
      </div>

      <label className="field">
        <span>Exchange</span>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {EXCHANGES.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name} · live
            </option>
          ))}
        </select>
      </label>

      <p className="field-hint">{exchange.blurb}</p>

      <label className="field">
        <span>API key</span>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <label className="field">
        <span>API secret</span>
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
            ? "Syncing live…"
            : linkedExchanges.includes(selected)
              ? "Linked"
              : "Connect live"}
        </button>
      </div>

      {status && <p className="status-ok">{status}</p>}
      {error && <p className="status-err-line">{error}</p>}
    </div>
  );
}
