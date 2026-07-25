"use client";

import { formatJpy } from "@/lib/tax/engine";
import { usePortfolio, useTaxSummary } from "./PortfolioProvider";
import { useI18n } from "./I18nProvider";

export function IncomeProfile() {
  const { otherIncomeJpy, setOtherIncomeJpy, incomeProvided } = usePortfolio();
  const { estimate } = useTaxSummary();
  const { t } = useI18n();

  return (
    <section className="income" id="income">
      <div className="income__intro">
        <p className="import-kicker">{t("income_kicker")}</p>
        <h2>{t("income_title")}</h2>
        <p>{t("income_sub")}</p>
      </div>

      <div className="income__simple">
        <label className="field">
          <span>{t("income_label")}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={otherIncomeJpy ? String(otherIncomeJpy) : ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/,/g, "");
              if (raw === "") {
                setOtherIncomeJpy(0);
                return;
              }
              setOtherIncomeJpy(Number(raw) || 0);
            }}
            placeholder={t("income_ph")}
          />
        </label>
        <p className="status-warn">
          {t("income_warn", { gain: formatJpy(estimate.taxableGainJpy) })}
          {incomeProvided && otherIncomeJpy > 0
            ? t("income_sketch", {
                tax: formatJpy(estimate.cryptoIncrementalTaxJpy),
              })
            : ""}
        </p>
      </div>
    </section>
  );
}
