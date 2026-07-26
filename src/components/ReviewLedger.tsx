"use client";

import type { TxSide } from "@/lib/tax/types";
import type { MessageKey } from "@/lib/i18n/messages";
import { formatJpy } from "@/lib/tax/engine";
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

export function ReviewLedger() {
  const { txs, updateTx, removeTx, toggleExclude } = usePortfolio();
  const { t } = useI18n();
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
      </div>
      <div className="table-wrap">
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
            {txs.map((tx) => (
              <tr
                key={tx.id}
                className={tx.excluded ? "row-excluded" : undefined}
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
                <td className="muted">
                  {tx.priceSource ?? "—"}
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
