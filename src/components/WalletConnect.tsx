"use client";

import { useState } from "react";
import type { CryptoTx } from "@/lib/tax/types";
import {
  isEnsName,
  isEthHexAddress,
  normalizeWalletInput,
} from "@/lib/ens-format";
import { shortAddr } from "@/lib/browser-wallet";
import {
  ETHERSCAN_CHAINS,
  allEtherscanChainIds,
  chainLabelForIds,
  getEtherscanChain,
} from "@/lib/import/etherscan-chains";
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

function toggleId(selected: number[], id: number): number[] {
  return selected.includes(id)
    ? selected.filter((x) => x !== id)
    : [...selected, id].sort((a, b) => a - b);
}

export function WalletConnect() {
  const {
    addTxs,
    markWalletLinked,
    linkedWallets,
    walletEnsLabels,
    walletChains,
    unlinkWallet,
  } = usePortfolio();
  const { t } = useI18n();
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [resolvedLine, setResolvedLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Advanced: when true, sync only checked chains; otherwise all Etherscan V2. */
  const [limitChains, setLimitChains] = useState(false);
  const [selectedChains, setSelectedChains] = useState<number[]>(() =>
    allEtherscanChainIds(),
  );

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

    if (limitChains && selectedChains.length === 0) {
      setError(t("wallet_chains_required"));
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
          ...(limitChains
            ? { chainIds: selectedChains }
            : { allChains: true }),
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
      const syncedChainIds = Array.isArray(data.chainIds)
        ? data.chainIds
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n))
        : [];
      addTxs(txs);
      markWalletLinked(syncedAddress, ens, syncedChainIds);
      if (ens) {
        setResolvedLine(
          t("wallet_resolved", { ens, address: syncedAddress }),
        );
      }
      const chainLabel =
        typeof data.chainLabel === "string" && data.chainLabel
          ? data.chainLabel
          : chainLabelForIds(syncedChainIds);
      const okLine = t("wallet_sync_ok", {
        chain: chainLabel,
        n: Number(data.count ?? txs.length),
      });
      const chainsSynced = Array.isArray(data.chainsSynced)
        ? (data.chainsSynced as Array<{
            name?: string;
            count?: number;
            error?: string;
          }>)
        : [];
      const failBits = chainsSynced
        .filter((c) => c.error)
        .map((c) => c.name || "?")
        .slice(0, 4);
      const failNote =
        failBits.length > 0
          ? ` ${t("wallet_chain_partial", { chains: failBits.join(", ") })}`
          : "";
      setStatus(
        data.truncated
          ? `${okLine} ${t("wallet_history_truncated")}${failNote}`
          : `${okLine}${failNote}`,
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
          disabled={
            busy ||
            !address.trim() ||
            (limitChains && selectedChains.length === 0)
          }
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

      <details
        className="wallet-chains-advanced"
        onToggle={(e) => {
          const open = e.currentTarget.open;
          setLimitChains(open);
          if (open) setSelectedChains(allEtherscanChainIds());
        }}
      >
        <summary>{t("wallet_chains_limit")}</summary>
        <fieldset className="wallet-chains" disabled={busy}>
          <legend>{t("wallet_chains_label")}</legend>
          <p className="field-hint">{t("wallet_chains_limit_hint")}</p>
          <div className="wallet-chains__grid">
            {ETHERSCAN_CHAINS.map((c) => (
              <label key={c.id} className="wallet-chains__opt">
                <input
                  type="checkbox"
                  checked={selectedChains.includes(c.id)}
                  onChange={() =>
                    setSelectedChains((prev) => toggleId(prev, c.id))
                  }
                />
                <span>
                  {c.name}
                  <small>{c.nativeSymbol}</small>
                </span>
              </label>
            ))}
          </div>
          <p className="field-hint wallet-chains__selected">
            {t("wallet_chains_selected", { n: selectedChains.length })}
          </p>
        </fieldset>
      </details>

      {/* Always under the sync form whenever anything is linked (incl. after refresh). */}
      {linkedWallets.length > 0 && (
        <ul className="link-list" aria-label={t("wallet_linked_list")}>
          {linkedWallets.map((w) => {
            const ens = walletEnsLabels[w.toLowerCase()];
            const chains = walletChains[w.toLowerCase()] ?? [];
            const chainNames = chains
              .map((id) => getEtherscanChain(id)?.name)
              .filter((n): n is string => Boolean(n));
            const label = ens
              ? t("wallet_linked_ens", {
                  ens,
                  address: shortAddr(w),
                })
              : t("wallet_linked", { address: shortAddr(w) });
            const chainLine =
              chainNames.length > 0
                ? t("wallet_linked_chains", {
                    chains:
                      chainNames.length <= 4
                        ? chainNames.join(", ")
                        : `${chainNames.slice(0, 4).join(", ")} +${chainNames.length - 4}`,
                  })
                : null;
            return (
              <li key={w} className="link-list__row link-list__row--stack">
                <div className="link-list__meta">
                  <span>{label}</span>
                  {chainLine && (
                    <span className="link-list__chains">{chainLine}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    unlinkWallet(w);
                    setStatus(t("unlink_wallet_cleared"));
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

      {busy && (
        <p className="wallet-sync-banner" role="status" aria-live="polite">
          <span className="spinner" aria-hidden />
          {busyBanner}
        </p>
      )}

      {resolvedLine && <p className="status-ok">{resolvedLine}</p>}
      {status && <p className="status-ok">{status}</p>}
      {error && <p className="status-err-line">{error}</p>}
    </div>
  );
}
