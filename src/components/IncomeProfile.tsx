"use client";

import { formatJpy } from "@/lib/tax/engine";
import { usePortfolio, useTaxSummary } from "./PortfolioProvider";

export function IncomeProfile() {
  const { otherIncomeJpy, setOtherIncomeJpy, incomeProvided } = usePortfolio();
  const { estimate } = useTaxSummary();

  return (
    <section className="income" id="income">
      <div className="income__intro">
        <p className="import-kicker">Crypto only</p>
        <h2>Optional: other income for a rough rate check</h2>
        <p>
          ZEI calculates <strong>crypto 雑所得 only</strong>. Enter other
          taxable income manually if you want a bracket sketch —{" "}
          <strong>not a final tax rate</strong>.
        </p>
      </div>

      <div className="income__simple">
        <label className="field">
          <span>Other taxable income (optional, JPY)</span>
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
            placeholder="e.g. 5000000"
          />
        </label>
        <p className="status-warn">
          Illustrative only. Your accountant / 確定申告 combines all income.
          Crypto gain this year: {formatJpy(estimate.taxableGainJpy)}.
          {incomeProvided && otherIncomeJpy > 0
            ? ` Rough crypto tax sketch: ${formatJpy(estimate.cryptoIncrementalTaxJpy)}.`
            : ""}
        </p>
      </div>
    </section>
  );
}
