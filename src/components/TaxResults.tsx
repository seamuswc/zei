"use client";

import {
  buildAccountantPack,
  downloadAccountantZip,
} from "@/lib/export/accountant";
import { formatJpy, formatQty } from "@/lib/tax/engine";
import { usePortfolio, useTaxSummary } from "./PortfolioProvider";
import { useI18n } from "./I18nProvider";
import type { MessageKey } from "@/lib/i18n/messages";

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
  const { t } = useI18n();

  if (txs.length === 0) {
    return (
      <section className="results results--empty" id="results">
        <p className="import-kicker">{t("results_empty_kicker")}</p>
        <h2>{t("results_empty_title")}</h2>
        <p>{t("results_empty_sub")}</p>
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

  function kindLabel(kind: string) {
    const key = `kind_${kind}` as MessageKey;
    try {
      return t(key);
    } catch {
      return kind;
    }
  }

  return (
    <section className="results" id="results">
      <div className="results__toolbar">
        <div>
          <p className="import-kicker">{t("results_kicker")}</p>
          <h2>{t("results_title", { year })}</h2>
        </div>
        <div className="results__controls">
          <label className="field field--inline">
            <span>{t("results_year")}</span>
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
            {t("results_export")}
          </button>
          <button type="button" className="btn btn--ghost" onClick={clearTxs}>
            {t("results_clear")}
          </button>
        </div>
      </div>

      <div className="stat-strip">
        <div className="stat">
          <span>{t("results_active")}</span>
          <strong>{summary.activeTxCount}</strong>
        </div>
        <div className="stat">
          <span>{t("results_matched")}</span>
          <strong>{summary.matchedTransferCount}</strong>
        </div>
        <div className="stat">
          <span>{t("results_income")}</span>
          <strong>{formatJpy(summary.totalIncomeJpy)}</strong>
        </div>
        <div className="stat">
          <span>{t("results_losses")}</span>
          <strong className="loss-text">{formatJpy(summary.totalLossJpy)}</strong>
        </div>
        <div className="stat">
          <span>{t("results_gains")}</span>
          <strong>{formatJpy(summary.totalPositiveGainJpy)}</strong>
        </div>
        <div className="stat stat--accent">
          <span>{t("results_net")}</span>
          <strong>{formatJpy(summary.totalGainJpy)}</strong>
        </div>
        {yearCarry && (
          <div className="stat">
            <span>{t("results_after_carry")}</span>
            <strong>{formatJpy(yearCarry.taxableAfterCarryJpy)}</strong>
          </div>
        )}
      </div>

      <p className="export-banner" id="export-note">
        {t("results_export_banner")}
      </p>

      <div className="estimate">
        <div>
          <p className="import-kicker">{t("results_impact_kicker")}</p>
          <h3>{formatJpy(summary.totalGainJpy)}</h3>
          <p>
            {t("results_impact_p")}
            {incomeProvided
              ? t("results_impact_sketch", {
                  other: formatJpy(otherIncomeJpy),
                  tax: formatJpy(estimate.cryptoIncrementalTaxJpy),
                })
              : t("results_impact_optional")}
          </p>
        </div>
        <div className="estimate__export">
          <p>{t("results_zip_p")}</p>
          <button type="button" className="btn btn--solid" onClick={exportPack}>
            {t("results_download")}
          </button>
        </div>
      </div>

      <div className="split-tables">
        <div>
          <h3>{t("results_disposals", { year })}</h3>
          {summary.disposals.length === 0 ? (
            <p className="muted">{t("results_no_disposals")}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("th_date")}</th>
                    <th>{t("th_kind")}</th>
                    <th>{t("th_asset")}</th>
                    <th>{t("th_qty")}</th>
                    <th>{t("th_proceeds")}</th>
                    <th>{t("th_cost")}</th>
                    <th>{t("th_gain")}</th>
                    <th>{t("th_price_src")}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.disposals.map((d) => (
                    <tr key={d.id}>
                      <td>{d.date}</td>
                      <td>{kindLabel(d.kind)}</td>
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
          <h3>{t("results_lots")}</h3>
          {summary.endingLots.length === 0 ? (
            <p className="muted">{t("results_no_lots")}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("th_asset")}</th>
                    <th>{t("th_qty")}</th>
                    <th>{t("th_avg")}</th>
                    <th>{t("th_book")}</th>
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
