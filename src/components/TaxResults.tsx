"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildAccountantPack,
  downloadAccountantZip,
} from "@/lib/export/accountant";
import { formatJpy } from "@/lib/tax/engine";
import { filingTaxYears, isFilingYearLocked } from "@/lib/billing";
import {
  exportBlockedByMissingPrices,
  txsNeedingPrice,
} from "@/lib/tax/price-quality";
import { usePortfolio, useTaxSummary } from "./PortfolioProvider";
import { useI18n } from "./I18nProvider";
import { useAuth } from "./AuthProvider";

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
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const locked = isFilingYearLocked(year, isPro);
  const [lastYear, thisYear] = filingTaxYears();
  const filingVars = { lastYear, thisYear };

  const missingPrices = useMemo(
    () => txsNeedingPrice(txs, year),
    [txs, year],
  );
  const pricesBlockExport =
    !locked && exportBlockedByMissingPrices(txs, year);

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
        <p className="muted" role="note">
          {t("results_empty_note")}
        </p>
        <a className="btn btn--solid" href="#import">
          {t("results_empty_cta")}
        </a>
      </section>
    );
  }

  async function exportPack() {
    setExportError(null);
    // Never ship ZIP bytes for locked filing years (client soft-lock + server gate).
    if (locked) return;
    if (exportBlockedByMissingPrices(txs, year)) {
      setExportError(t("export_blocked_prices", { n: missingPrices.length }));
      return;
    }

    setExportBusy(true);
    try {
      if (user) {
        const res = await fetch("/api/export/accountant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year,
            txs,
            otherIncomeJpy,
            matchedTransfers: matches.length,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            code?: string;
          };
          if (data.code === "missing_prices") {
            setExportError(
              t("export_blocked_prices", { n: missingPrices.length }),
            );
            return;
          }
          if (data.code === "pro_required" || res.status === 403) {
            setExportError(t("freemium_export_locked", filingVars));
            return;
          }
          throw new Error(data.error || "Export failed");
        }
        const blob = await res.blob();
        const cd = res.headers.get("Content-Disposition") || "";
        const match = /filename="([^"]+)"/.exec(cd);
        const filename =
          match?.[1] ??
          `ZEI_tax_pack_${year}_${new Date().toISOString().slice(0, 10)}.zip`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      // Guest / unlocked years: client-side pack (still blocked above if locked/prices).
      const pack = buildAccountantPack({
        year,
        txs,
        summary,
        otherIncomeJpy,
        matchedTransfers: matches.length,
      });
      downloadAccountantZip(pack.filename, pack.files);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportBusy(false);
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
  const exportDisabled = locked || pricesBlockExport || exportBusy;

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
            disabled={exportDisabled}
            onClick={() => void exportPack()}
          >
            {exportBusy ? t("auth_creating") : t("results_export")}
          </button>
          <button type="button" className="btn btn--ghost" onClick={clearTxs}>
            {t("results_clear")}
          </button>
        </div>
      </div>

      <p className="field-hint results-clear-hint">{t("results_clear_hint")}</p>

      <p className="results-honesty" role="note">
        {t("results_honesty")}
      </p>

      {pricesBlockExport && (
        <div className="price-warning" role="alert">
          <p>{t("export_blocked_prices", { n: missingPrices.length })}</p>
          <a className="btn btn--solid btn--sm" href="#review">
            {t("export_fix_prices_cta")}
          </a>
        </div>
      )}
      {exportError && <p className="status-err-line">{exportError}</p>}

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
          <div className="stat stat--muted">
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
          : pricesBlockExport
            ? t("export_blocked_prices", { n: missingPrices.length })
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
            disabled={exportDisabled}
            onClick={() => void exportPack()}
          >
            {exportBusy ? t("auth_creating") : t("results_download")}
          </button>
        </div>
      </div>
    </section>
  );
}
