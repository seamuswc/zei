"use client";

import { useMemo, useState } from "react";
import type { TxSide } from "@/lib/tax/types";
import type { MessageKey } from "@/lib/i18n/messages";
import { formatJpy } from "@/lib/tax/engine";
import { txsNeedingPrice } from "@/lib/tax/price-quality";
import { usePortfolio } from "./PortfolioProvider";
import { useI18n } from "./I18nProvider";

const SIDES: TxSide[] = [
  "buy",
  "sell",
  "transfer_in",
  "transfer_out",
  "income",
  "fee",
  "wrap",
  "bridge",
  "borrow",
  "repay",
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 0] as const;

export function ReviewLedger() {
  const { txs, year, updateTx, removeTx, toggleExclude } = usePortfolio();
  const { t } = useI18n();
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);

  const total = txs.length;
  const effectiveSize = pageSize === 0 ? Math.max(total, 1) : pageSize;
  const pageCount = Math.max(1, Math.ceil(total / effectiveSize));
  const currentPage = Math.min(page, pageCount - 1);
  const start = total === 0 ? 0 : currentPage * effectiveSize;
  const end = Math.min(start + effectiveSize, total);
  const pageTxs = txs.slice(start, end);
  const needPriceIds = useMemo(() => {
    const set = new Set(txsNeedingPrice(txs, year).map((t) => t.id));
    // Also flag other years' unknown sell/income so Review is useful after import
    for (const tx of txs) {
      if (tx.excluded) continue;
      if (tx.side !== "sell" && tx.side !== "income") continue;
      if (tx.priceSource === "unknown" || !(tx.jpyValue > 0)) set.add(tx.id);
    }
    return set;
  }, [txs, year]);
  const needPriceCount = needPriceIds.size;

  if (txs.length === 0) return null;

  function sideLabel(side: TxSide) {
    return t(`side_${side}` as MessageKey);
  }

  return (
    <section className="ledger" id="review">
      <div className="ledger__head">
        <p className="import-kicker">{t("review_kicker")}</p>
        <h2>{t("review_title")}</h2>
        <p>{t("review_sub")}</p>
        {needPriceCount > 0 && (
          <p className="price-warning price-warning--inline" role="status">
            {t("review_needs_price", { n: needPriceCount })}
          </p>
        )}
      </div>
      <div className="ledger-pager">
        <p className="ledger-pager__meta">
          {t("ledger_showing", {
            from: total === 0 ? 0 : start + 1,
            to: end,
            total,
          })}
        </p>
        <label className="ledger-pager__size">
          <span>{t("ledger_page_size")}</span>
          <select
            className="cell-input cell-input--side"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? t("ledger_page_all") : n}
              </option>
            ))}
          </select>
        </label>
        <div className="ledger-pager__nav">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={currentPage <= 0}
            onClick={() => setPage(Math.max(0, currentPage - 1))}
          >
            {t("ledger_prev")}
          </button>
          <span className="ledger-pager__page">
            {t("ledger_page", { page: currentPage + 1, pages: pageCount })}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(Math.min(pageCount - 1, currentPage + 1))}
          >
            {t("ledger_next")}
          </button>
        </div>
      </div>
      <div className="table-wrap ledger-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("th_date")}</th>
              <th>{t("th_asset")}</th>
              <th>{t("th_side")}</th>
              <th>{t("th_qty")}</th>
              <th>{t("th_jpy")}</th>
              <th>{t("th_fee")}</th>
              <th>{t("th_cost_override")}</th>
              <th>{t("th_price_src")}</th>
              <th>{t("th_actions")}</th>
            </tr>
          </thead>
          <tbody>
            {pageTxs.map((tx) => {
              const needsPrice = needPriceIds.has(tx.id);
              const rowClass = [
                tx.excluded ? "row-excluded" : "",
                needsPrice ? "row-needs-price" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
              <tr
                key={tx.id}
                className={rowClass || undefined}
              >
                <td>
                  <input
                    className="cell-input"
                    value={tx.date}
                    onChange={(e) => updateTx(tx.id, { date: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--asset"
                    value={tx.asset}
                    onChange={(e) =>
                      updateTx(tx.id, {
                        asset: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </td>
                <td>
                  <select
                    className="cell-input cell-input--side"
                    value={tx.side}
                    onChange={(e) =>
                      updateTx(tx.id, { side: e.target.value as TxSide })
                    }
                  >
                    {SIDES.map((s) => (
                      <option key={s} value={s}>
                        {sideLabel(s)}
                      </option>
                    ))}
                  </select>
                  {tx.matchedTransferId && (
                    <div className="match-tag">{t("review_matched")}</div>
                  )}
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    type="number"
                    step="any"
                    value={tx.quantity}
                    onChange={(e) =>
                      updateTx(tx.id, {
                        quantity: Number(e.target.value) || 0,
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    type="number"
                    value={tx.jpyValue}
                    onChange={(e) =>
                      updateTx(tx.id, {
                        jpyValue: Number(e.target.value) || 0,
                        priceSource: "manual",
                        unitPriceJpy:
                          tx.quantity > 0
                            ? (Number(e.target.value) || 0) / tx.quantity
                            : undefined,
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    type="number"
                    value={tx.feeJpy ?? ""}
                    placeholder="0"
                    onChange={(e) =>
                      updateTx(tx.id, {
                        feeJpy:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value) || 0,
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    type="number"
                    value={tx.costBasisOverrideJpy ?? ""}
                    placeholder={t("review_auto")}
                    onChange={(e) =>
                      updateTx(tx.id, {
                        costBasisOverrideJpy:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value) || 0,
                      })
                    }
                  />
                </td>
                <td className={needsPrice ? "needs-price" : "muted"}>
                  {tx.priceSource ?? "—"}
                  {needsPrice ? ` · ${t("price_needs_fix")}` : ""}
                  <div className="tiny">
                    {tx.source}
                    {tx.exchange ? ` · ${tx.exchange}` : ""}
                  </div>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => toggleExclude(tx.id)}
                    >
                      {tx.excluded ? t("review_include") : t("review_exclude")}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => removeTx(tx.id)}
                    >
                      {t("review_delete")}
                    </button>
                  </div>
                  <div className="muted tiny">{formatJpy(tx.jpyValue)}</div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
