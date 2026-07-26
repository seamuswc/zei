"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const {
    txs,
    year,
    updateTx,
    updateManyTxs,
    removeTx,
    removeManyTxs,
    toggleExclude,
    setExcludedMany,
  } = usePortfolio();
  const { t } = useI18n();
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkJpy, setBulkJpy] = useState("");
  const [filterNeedsPrice, setFilterNeedsPrice] = useState(false);

  const needPriceIds = useMemo(() => {
    const set = new Set(txsNeedingPrice(txs, year).map((tx) => tx.id));
    // Also flag other years' unknown sell/income so Review is useful after import
    for (const tx of txs) {
      if (tx.excluded) continue;
      if (tx.side !== "sell" && tx.side !== "income") continue;
      if (tx.priceSource === "unknown" || !(tx.jpyValue > 0)) set.add(tx.id);
    }
    return set;
  }, [txs, year]);
  const needPriceCount = needPriceIds.size;

  const visibleTxs = useMemo(() => {
    if (!filterNeedsPrice) return txs;
    return txs.filter((tx) => needPriceIds.has(tx.id));
  }, [txs, filterNeedsPrice, needPriceIds]);

  const total = visibleTxs.length;
  const effectiveSize = pageSize === 0 ? Math.max(total, 1) : pageSize;
  const pageCount = Math.max(1, Math.ceil(total / effectiveSize));
  const currentPage = Math.min(page, pageCount - 1);
  const start = total === 0 ? 0 : currentPage * effectiveSize;
  const end = Math.min(start + effectiveSize, total);
  const pageTxs = visibleTxs.slice(start, end);
  const pageIds = useMemo(() => pageTxs.map((tx) => tx.id), [pageTxs]);
  const selectedOnPage = pageIds.filter((id) => selected.has(id));
  const allOnPageSelected =
    pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const someOnPageSelected =
    selectedOnPage.length > 0 && selectedOnPage.length < pageIds.length;
  const selectedCount = selected.size;
  const selectedList = useMemo(() => [...selected], [selected]);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPage(0);
  }, [filterNeedsPrice, pageSize]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someOnPageSelected;
    }
  }, [someOnPageSelected]);

  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set(txs.map((tx) => tx.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (alive.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [txs]);

  if (txs.length === 0) return null;

  function sideLabel(side: TxSide) {
    return t(`side_${side}` as MessageKey);
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function toggleSelectAllOnPage() {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of pageIds) next.delete(id);
        return next;
      });
    } else {
      selectAllOnPage();
    }
  }

  function selectNeedsPrice() {
    setSelected(new Set(needPriceIds));
    setFilterNeedsPrice(true);
  }

  function applyBulkJpy(clear: boolean) {
    if (selectedList.length === 0) return;
    const value = clear ? 0 : Number(bulkJpy);
    if (!clear && !Number.isFinite(value)) return;
    updateManyTxs(selectedList, (tx) => ({
      jpyValue: clear ? 0 : value,
      priceSource: "manual",
      unitPriceJpy:
        tx.quantity > 0 ? (clear ? 0 : value) / tx.quantity : undefined,
    }));
    if (!clear) setBulkJpy("");
  }

  function bulkExclude(excluded: boolean) {
    if (selectedList.length === 0) return;
    setExcludedMany(selectedList, excluded);
  }

  function bulkDelete() {
    if (selectedList.length === 0) return;
    if (!window.confirm(t("ledger_bulk_delete_confirm", { n: selectedList.length }))) {
      return;
    }
    removeManyTxs(selectedList);
    clearSelection();
  }

  return (
    <section className="ledger" id="review">
      <div className="ledger__head">
        <p className="import-kicker">{t("review_kicker")}</p>
        <h2>{t("review_title")}</h2>
        <p>{t("review_sub")}</p>
        {needPriceCount > 0 && (
          <p className="price-warning price-warning--inline" role="status">
            {t("review_needs_price", { n: needPriceCount })}{" "}
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={selectNeedsPrice}
            >
              {t("ledger_select_needs_price")}
            </button>
          </p>
        )}
      </div>

      <div className="ledger-toolbar">
        <div className="ledger-toolbar__select">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={selectAllOnPage}
            disabled={pageIds.length === 0}
          >
            {t("ledger_select_page")}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={clearSelection}
            disabled={selectedCount === 0}
          >
            {t("ledger_clear_selection")}
          </button>
          <label className="ledger-filter">
            <input
              type="checkbox"
              checked={filterNeedsPrice}
              onChange={(e) => setFilterNeedsPrice(e.target.checked)}
            />
            <span>{t("ledger_filter_needs_price")}</span>
          </label>
          <span className="ledger-toolbar__count" aria-live="polite">
            {t("ledger_selected_count", { n: selectedCount })}
          </span>
        </div>

        <div
          className={`ledger-bulk${selectedCount === 0 ? " ledger-bulk--disabled" : ""}`}
        >
          <label className="ledger-bulk__jpy">
            <span>{t("ledger_bulk_jpy_label")}</span>
            <input
              className="cell-input cell-input--num"
              type="number"
              inputMode="decimal"
              value={bulkJpy}
              placeholder="0"
              disabled={selectedCount === 0}
              onChange={(e) => setBulkJpy(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={selectedCount === 0 || bulkJpy === ""}
            onClick={() => applyBulkJpy(false)}
          >
            {t("ledger_bulk_set_jpy")}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={selectedCount === 0}
            onClick={() => applyBulkJpy(true)}
          >
            {t("ledger_bulk_clear_jpy")}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={selectedCount === 0}
            onClick={() => bulkExclude(true)}
          >
            {t("ledger_bulk_exclude")}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={selectedCount === 0}
            onClick={() => bulkExclude(false)}
          >
            {t("ledger_bulk_include")}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={selectedCount === 0}
            onClick={bulkDelete}
          >
            {t("ledger_bulk_delete")}
          </button>
        </div>
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
              <th className="col-check">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleSelectAllOnPage}
                  aria-label={t("ledger_select_page")}
                  disabled={pageIds.length === 0}
                />
              </th>
              <th className="col-date">{t("th_date")}</th>
              <th>{t("th_asset")}</th>
              <th>{t("th_side")}</th>
              <th>{t("th_qty")}</th>
              <th>{t("th_jpy")}</th>
              <th>{t("th_fee")}</th>
              <th>{t("th_cost_override")}</th>
              <th className="col-price-src">{t("th_price_src")}</th>
              <th>{t("th_actions")}</th>
            </tr>
          </thead>
          <tbody>
            {pageTxs.map((tx) => {
              const needsPrice = needPriceIds.has(tx.id);
              const isSelected = selected.has(tx.id);
              const rowClass = [
                tx.excluded ? "row-excluded" : "",
                needsPrice ? "row-needs-price" : "",
                isSelected ? "row-selected" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <tr key={tx.id} className={rowClass || undefined}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(tx.id)}
                      aria-label={t("ledger_select_row")}
                    />
                  </td>
                  <td className="col-date">
                    <input
                      className="cell-input cell-input--date"
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
                  <td className={needsPrice ? "col-jpy col-jpy--needs" : "col-jpy"}>
                    <input
                      className={`cell-input cell-input--num cell-input--jpy${needsPrice ? " cell-input--jpy-needs" : ""}`}
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
                  <td
                    className={
                      needsPrice ? "col-price-src needs-price" : "col-price-src muted"
                    }
                  >
                    <div className="price-src-line">
                      <span className="price-src-label">
                        {tx.priceSource ?? "—"}
                      </span>
                      {needsPrice && (
                        <span className="badge-needs-price">
                          {t("price_needs_fix")}
                        </span>
                      )}
                    </div>
                    <div className="tiny price-src-notes">
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
