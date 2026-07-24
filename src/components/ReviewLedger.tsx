"use client";

import type { TxSide } from "@/lib/tax/types";
import { formatJpy } from "@/lib/tax/engine";
import { usePortfolio } from "./PortfolioProvider";

const SIDES: TxSide[] = [
  "buy",
  "sell",
  "transfer_in",
  "transfer_out",
  "income",
  "fee",
  "wrap",
];

export function ReviewLedger() {
  const { txs, updateTx, removeTx, toggleExclude } = usePortfolio();
  if (txs.length === 0) return null;

  return (
    <section className="ledger" id="review">
      <div className="ledger__head">
        <p className="import-kicker">Review · fully editable</p>
        <h2>Edit prices, quantities, and cost basis</h2>
        <p>
          Change any field. <strong>JPY</strong> is the price/proceeds total.
          <strong> Cost override</strong> is optional — on buys it sets
          acquisition cost; on sells/fees it sets 取得価額 instead of 移動平均.
          Leave blank to use the engine.
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Asset</th>
              <th>Side</th>
              <th>Qty</th>
              <th>JPY (price)</th>
              <th>Fee JPY</th>
              <th>Cost override</th>
              <th>Price src</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((t) => (
              <tr
                key={t.id}
                className={t.excluded ? "row-excluded" : undefined}
              >
                <td>
                  <input
                    className="cell-input"
                    value={t.date}
                    onChange={(e) => updateTx(t.id, { date: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--asset"
                    value={t.asset}
                    onChange={(e) =>
                      updateTx(t.id, {
                        asset: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </td>
                <td>
                  <select
                    className="cell-input cell-input--side"
                    value={t.side}
                    onChange={(e) =>
                      updateTx(t.id, { side: e.target.value as TxSide })
                    }
                  >
                    {SIDES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {t.matchedTransferId && (
                    <div className="match-tag">matched</div>
                  )}
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    type="number"
                    step="any"
                    value={t.quantity}
                    onChange={(e) =>
                      updateTx(t.id, {
                        quantity: Number(e.target.value) || 0,
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    type="number"
                    value={t.jpyValue}
                    onChange={(e) =>
                      updateTx(t.id, {
                        jpyValue: Number(e.target.value) || 0,
                        priceSource: "csv_provided",
                        unitPriceJpy:
                          t.quantity > 0
                            ? (Number(e.target.value) || 0) / t.quantity
                            : undefined,
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell-input cell-input--num"
                    type="number"
                    value={t.feeJpy ?? ""}
                    placeholder="0"
                    onChange={(e) =>
                      updateTx(t.id, {
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
                    value={t.costBasisOverrideJpy ?? ""}
                    placeholder="auto"
                    onChange={(e) =>
                      updateTx(t.id, {
                        costBasisOverrideJpy:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value) || 0,
                      })
                    }
                  />
                </td>
                <td className="muted">
                  {t.priceSource ?? "—"}
                  <div className="tiny">
                    {t.source}
                    {t.exchange ? ` · ${t.exchange}` : ""}
                  </div>
                  {t.note && <div className="tiny">{t.note}</div>}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => toggleExclude(t.id)}
                    >
                      {t.excluded ? "Include" : "Exclude"}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => removeTx(t.id)}
                    >
                      Delete
                    </button>
                  </div>
                  <div className="muted tiny">{formatJpy(t.jpyValue)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
