import { filingTaxYears, isFilingYearLocked } from "./billing";

{
  const now = new Date("2026-07-26T00:00:00Z");
  const [last, curr] = filingTaxYears(now);
  if (last !== 2025 || curr !== 2026) {
    throw new Error(`filing years mismatch: ${last},${curr}`);
  }
  if (!isFilingYearLocked(2025, false, now) || !isFilingYearLocked(2026, false, now)) {
    throw new Error("filing years should be locked for free");
  }
  if (isFilingYearLocked(2024, false, now)) {
    throw new Error("older years should be free");
  }
  if (isFilingYearLocked(2025, true, now) || isFilingYearLocked(2026, true, now)) {
    throw new Error("Pro should unlock filing years");
  }
}

console.log("billing-export checks ok");
