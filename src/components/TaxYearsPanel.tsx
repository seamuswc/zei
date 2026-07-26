"use client";

import { formatJpy } from "@/lib/tax/engine";
import { isFilingYearLocked } from "@/lib/billing";
import { usePortfolio } from "./PortfolioProvider";
import { useI18n } from "./I18nProvider";
import { useAuth } from "./AuthProvider";

export function TaxYearsPanel() {
  const { taxYears } = usePortfolio();
  const { t } = useI18n();
  const { isPro } = useAuth();
  if (!taxYears.length) return null;

  return (
    <section className="income" id="years">
      <div className="income__intro">
        <p className="import-kicker">{t("years_kicker")}</p>
        <h2>{t("years_title")}</h2>
        <p>{t("years_sub")}</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("years_th_year")}</th>
              <th>{t("years_th_net")}</th>
              <th>{t("years_th_in")}</th>
              <th>{t("years_th_after")}</th>
              <th>{t("years_th_out")}</th>
            </tr>
          </thead>
          <tbody>
            {taxYears.map((y) => {
              const locked = isFilingYearLocked(y.year, isPro);
              return (
                <tr
                  key={y.year}
                  className={locked ? "years-row--locked" : undefined}
                >
                  <td>
                    {locked
                      ? t("freemium_year_option", { year: y.year })
                      : y.year}
                  </td>
                  {locked ? (
                    <>
                      <td className="muted">{t("freemium_cell_locked")}</td>
                      <td className="muted">{t("freemium_cell_locked")}</td>
                      <td className="muted">{t("freemium_cell_locked")}</td>
                      <td className="muted">{t("freemium_cell_locked")}</td>
                    </>
                  ) : (
                    <>
                      <td className={y.netGainJpy >= 0 ? "gain" : "loss"}>
                        {formatJpy(y.netGainJpy)}
                      </td>
                      <td>{formatJpy(y.carriedInJpy)}</td>
                      <td>{formatJpy(y.taxableAfterCarryJpy)}</td>
                      <td>{formatJpy(y.carriedOutJpy)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
