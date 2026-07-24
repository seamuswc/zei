"use client";

import { useState } from "react";
import type { CryptoTx } from "@/lib/tax/types";
import { usePortfolio } from "./PortfolioProvider";

export function WalletConnect() {
  const { addTxs, connectedWallet, setConnectedWallet } = usePortfolio();
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
        `Live sync · ${data.chain} · ${data.count ?? 0} valued transfers (JPY via CoinGecko).`,
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
        <p className="import-kicker">02 · On-chain · live</p>
        <h3>Connect wallet</h3>
        <p>
          Live read: Ethereum native + major ERC-20 (Etherscan) or Bitcoin
          (blockchain.info), priced to JPY with audit trail.
        </p>
      </div>

      <label className="field">
        <span>Wallet address</span>
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
          <span>Etherscan API key</span>
          <input
            value={etherscanKey}
            onChange={(e) => setEtherscanKey(e.target.value)}
            placeholder="Free key from etherscan.io/apikey"
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
          {busy ? "Syncing live…" : "Connect & sync"}
        </button>
      </div>

      {needsEthKey && !etherscanKey.trim() && (
        <p className="field-hint">
          Ethereum needs an Etherscan key here, or set ETHERSCAN_API_KEY in the
          server env.
        </p>
      )}

      {connectedWallet && (
        <p className="status-meta">Linked: {connectedWallet}</p>
      )}
      {status && <p className="status-ok">{status}</p>}
      {error && <p className="status-err-line">{error}</p>}
    </div>
  );
}
