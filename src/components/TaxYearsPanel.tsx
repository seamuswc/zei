"use client";

import { formatJpy } from "@/lib/tax/engine";
import { usePortfolio } from "./PortfolioProvider";

export function TaxYearsPanel() {
  const { taxYears } = usePortfolio();
  if (!taxYears.length) return null;

  return (
    <section className="income" id="years">
      <div className="income__intro">
        <p className="import-kicker">Multi-year · account</p>
        <h2>Crypto loss carry across years</h2>
        <p>
          Stored on your account when you save.{" "}
          <strong>
            Japan generally does not allow 雑所得 loss carryforward
          </strong>{" "}
          — this is an accountant helper; confirm before filing.
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Net crypto</th>
              <th>Carry in</th>
              <th>After carry</th>
              <th>Carry out</th>
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
