"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildAccountantPack,
  downloadAccountantZip,
} from "@/lib/export/accountant";
import { formatJpy, formatQty } from "@/lib/tax/engine";
import { filingTaxYears, isFilingYearLocked } from "@/lib/billing";
import { usePortfolio, useTaxSummary } from "./PortfolioProvider";
import { useI18n } from "./I18nProvider";
import { useAuth } from "./AuthProvider";
import type { MessageKey } from "@/lib/i18n/messages";

export function TaxResults() {
  const {
    year,
    setYear,
    txs,
    clearTxs,
    otherIncomeJpy,
    incomeProvided,
    availableYears,
  } = usePortfolio();
  const { summary, estimate, matches, yearCarry } = useTaxSummary();
  const { t } = useI18n();
  const { user, isPro, loading, startProPay } = useAuth();
  const userPickedYear = useRef(false);
  const [payBusy, setPayBusy] = useState(false);

  const locked = isFilingYearLocked(year, isPro);
  const [lastYear, thisYear] = filingTaxYears();
  const filingVars = { lastYear, thisYear };

  // Steer free users off both locked filing years by default (still selectable → paywall).
  useEffect(() => {
    if (loading || isPro || userPickedYear.current) return;
    if (!isFilingYearLocked(year, false)) return;
    const alt = availableYears.find((y) => !isFilingYearLocked(y, false));
    if (alt != null) setYear(alt);
  }, [loading, isPro, year, availableYears, setYear]);

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
    if (locked) return;
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

  async function unlock() {
    if (!user) {
      document.querySelector<HTMLButtonElement>(".auth-menu > button")?.click();
      return;
    }
    setPayBusy(true);
    try {
      await startProPay();
    } finally {
      setPayBusy(false);
    }
  }

  const masked = "—";

  return (
    <section
      className={`results${locked ? " results--locked" : ""}`}
      id="results"
    >
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
              onChange={(e) => {
                userPickedYear.current = true;
                setYear(Number(e.target.value));
              }}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {isFilingYearLocked(y, isPro)
                    ? t("freemium_year_option", { year: y })
                    : String(y)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn--solid"
            disabled={locked}
            onClick={exportPack}
          >
            {t("results_export")}
          </button>
          <button type="button" className="btn btn--ghost" onClick={clearTxs}>
            {t("results_clear")}
          </button>
        </div>
      </div>

      <p className="field-hint results-clear-hint">{t("results_clear_hint")}</p>

      {locked && (
        <div className="paywall">
          <p className="import-kicker">{t("freemium_locked_kicker")}</p>
          <h3>{t("freemium_locked_title", filingVars)}</h3>
          <p>{t("freemium_locked_body", filingVars)}</p>
          <button
            type="button"
            className="btn btn--solid"
            disabled={payBusy}
            onClick={() => void unlock()}
          >
            {user ? t("freemium_cta_pay") : t("freemium_cta_login")}
          </button>
        </div>
      )}

      <div className={`stat-strip${locked ? " is-blurred" : ""}`} aria-hidden={locked}>
        <div className="stat">
          <span>{t("results_active")}</span>
          <strong>{locked ? masked : summary.activeTxCount}</strong>
        </div>
        <div className="stat">
          <span>{t("results_matched")}</span>
          <strong>{locked ? masked : summary.matchedTransferCount}</strong>
        </div>
        <div className="stat">
          <span>{t("results_income")}</span>
          <strong>{locked ? masked : formatJpy(summary.totalIncomeJpy)}</strong>
        </div>
        <div className="stat">
          <span>{t("results_losses")}</span>
          <strong className="loss-text">
            {locked ? masked : formatJpy(summary.totalLossJpy)}
          </strong>
        </div>
        <div className="stat">
          <span>{t("results_gains")}</span>
          <strong>
            {locked ? masked : formatJpy(summary.totalPositiveGainJpy)}
          </strong>
        </div>
        <div className="stat stat--accent">
          <span>{t("results_net")}</span>
          <strong>{locked ? masked : formatJpy(summary.totalGainJpy)}</strong>
        </div>
        {yearCarry && (
          <div className="stat">
            <span>{t("results_after_carry")}</span>
            <strong>
              {locked ? masked : formatJpy(yearCarry.taxableAfterCarryJpy)}
            </strong>
          </div>
        )}
      </div>

      <p className="export-banner" id="export-note">
        {locked
          ? t("freemium_export_locked", filingVars)
          : t("results_export_banner")}
      </p>

      <div className={`estimate${locked ? " is-blurred" : ""}`} aria-hidden={locked}>
        <div>
          <p className="import-kicker">{t("results_impact_kicker")}</p>
          <h3>{locked ? masked : formatJpy(summary.totalGainJpy)}</h3>
          <p>
            {t("results_impact_p")}
            {!locked &&
              (incomeProvided
                ? t("results_impact_sketch", {
                    other: formatJpy(otherIncomeJpy),
                    tax: formatJpy(estimate.cryptoIncrementalTaxJpy),
                  })
                : t("results_impact_optional"))}
          </p>
        </div>
        <div className="estimate__export">
          <p>{t("results_zip_p")}</p>
          <button
            type="button"
            className="btn btn--solid"
            disabled={locked}
            onClick={exportPack}
          >
            {t("results_download")}
          </button>
        </div>
      </div>

      <div
        className={`split-tables${locked ? " is-blurred" : ""}`}
        aria-hidden={locked}
      >
        <div>
          <h3>{t("results_disposals", { year })}</h3>
          {locked ? (
            <p className="muted">{t("freemium_table_locked")}</p>
          ) : summary.disposals.length === 0 ? (
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
          {locked ? (
            <p className="muted">{t("freemium_table_locked")}</p>
          ) : summary.endingLots.length === 0 ? (
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
