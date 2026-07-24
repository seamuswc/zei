"use client";

import {
  buildAccountantPack,
  downloadAccountantZip,
} from "@/lib/export/accountant";
import { formatJpy, formatQty } from "@/lib/tax/engine";
import { usePortfolio, useTaxSummary } from "./PortfolioProvider";

export function TaxResults() {
  const {
    year,
    setYear,
    txs,
    clearTxs,
    otherIncomeJpy,
    incomeProvided,
  } = usePortfolio();
  const { summary, estimate, matches, yearCarry } = useTaxSummary();

  if (txs.length === 0) {
    return (
      <section className="results results--empty" id="results">
        <p className="import-kicker">Crypto tax year</p>
        <h2>Your crypto 雑所得 appears here</h2>
        <p>
          Import spreadsheets, live wallets, or live exchanges — we run
          移動平均法 for crypto only.
        </p>
      </section>
    );
  }

  function exportPack() {
    const pack = buildAccountantPack({
      year,
      txs,
      summary,
      otherIncomeJpy,
      matchedTransfers: matches.length,
    });
    downloadAccountantZip(pack.filename, pack.files);
  }

  return (
    <section className="results" id="results">
      <div className="results__toolbar">
        <div>
          <p className="import-kicker">Crypto only · 移動平均法</p>
          <h2>{year} crypto 雑所得</h2>
        </div>
        <div className="results__controls">
          <label className="field field--inline">
            <span>Year</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[2023, 2024, 2025, 2026].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn--solid" onClick={exportPack}>
            Export for accountant
          </button>
          <button type="button" className="btn btn--ghost" onClick={clearTxs}>
            Clear all
          </button>
        </div>
      </div>

      <div className="stat-strip">
        <div className="stat">
          <span>Active txs</span>
          <strong>{summary.activeTxCount}</strong>
        </div>
        <div className="stat">
          <span>Matched transfers</span>
          <strong>{summary.matchedTransferCount}</strong>
        </div>
        <div className="stat">
          <span>Income / rewards</span>
          <strong>{formatJpy(summary.totalIncomeJpy)}</strong>
        </div>
        <div className="stat">
          <span>Losses</span>
          <strong className="loss-text">{formatJpy(summary.totalLossJpy)}</strong>
        </div>
        <div className="stat">
          <span>Positive gains</span>
          <strong>{formatJpy(summary.totalPositiveGainJpy)}</strong>
        </div>
        <div className="stat stat--accent">
          <span>Net crypto 雑所得</span>
          <strong>{formatJpy(summary.totalGainJpy)}</strong>
        </div>
        {yearCarry && (
          <div className="stat">
            <span>After loss carry</span>
            <strong>{formatJpy(yearCarry.taxableAfterCarryJpy)}</strong>
          </div>
        )}
      </div>

      <p className="export-banner" id="export-note">
        Tax accountant pack: click <strong>Export for accountant</strong> to
        download a ZIP (README + 売却明細 + 期末残高 + 全取引台帳).
      </p>

      <div className="estimate">
        <div>
          <p className="import-kicker">Crypto gain (not final tax)</p>
          <h3>{formatJpy(summary.totalGainJpy)}</h3>
          <p>
            Net figure for your accountant after sells, income receipts, and
            in-asset fees. Japan adds this to other income under progressive
            brackets — this app does not finalize that.
            {incomeProvided
              ? ` Rough sketch if other 課税所得 were ${formatJpy(otherIncomeJpy)}: about ${formatJpy(estimate.cryptoIncrementalTaxJpy)} on positive crypto only (illustrative).`
              : " Optional other-income field only sketches a rate."}
          </p>
        </div>
        <div className="estimate__export">
          <p>
            ZIP for 税理士: sale detail, lots, full ledger with price sources,
            matched transfers, Japanese README.
          </p>
          <button type="button" className="btn btn--solid" onClick={exportPack}>
            Download accountant pack
          </button>
        </div>
      </div>

      <div className="split-tables">
        <div>
          <h3>Disposals / income in {year}</h3>
          {summary.disposals.length === 0 ? (
            <p className="muted">No taxable events in this year yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Kind</th>
                    <th>Asset</th>
                    <th>Qty</th>
                    <th>Proceeds</th>
                    <th>Cost</th>
                    <th>Gain</th>
                    <th>Price src</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.disposals.map((d) => (
                    <tr key={d.id}>
                      <td>{d.date}</td>
                      <td>{d.kind}</td>
                      <td>{d.asset}</td>
                      <td>{formatQty(d.quantity)}</td>
                      <td>{formatJpy(d.proceedsJpy)}</td>
                      <td>{formatJpy(d.costBasisJpy)}</td>
                      <td className={d.gainJpy >= 0 ? "gain" : "loss"}>
                        {formatJpy(d.gainJpy)}
                      </td>
                      <td className="muted">{d.priceSource ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3>Ending lots (移動平均)</h3>
          {summary.endingLots.length === 0 ? (
            <p className="muted">No open positions.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Qty</th>
                    <th>Avg cost</th>
                    <th>Book value</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.endingLots.map((l) => (
                    <tr key={l.asset}>
                      <td>{l.asset}</td>
                      <td>{formatQty(l.quantity)}</td>
                      <td>{formatJpy(l.avgCostJpy)}</td>
                      <td>{formatJpy(l.totalCostJpy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
