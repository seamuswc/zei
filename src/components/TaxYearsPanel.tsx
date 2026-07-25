"use client";

import { formatJpy } from "@/lib/tax/engine";
import { usePortfolio } from "./PortfolioProvider";
import { useI18n } from "./I18nProvider";

export function TaxYearsPanel() {
  const { taxYears } = usePortfolio();
  const { t } = useI18n();
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
            {taxYears.map((y) => (
              <tr key={y.year}>
                <td>{y.year}</td>
                <td className={y.netGainJpy >= 0 ? "gain" : "loss"}>
                  {formatJpy(y.netGainJpy)}
                </td>
                <td>{formatJpy(y.carriedInJpy)}</td>
                <td>{formatJpy(y.taxableAfterCarryJpy)}</td>
                <td>{formatJpy(y.carriedOutJpy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
