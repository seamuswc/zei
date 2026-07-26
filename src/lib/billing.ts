/**
 * The Japan tax year that matters for filing / Pro unlock.
 * In calendar year Y, that is usually Y−1 (the return people prepare).
 */
export function filingTaxYear(now = new Date()): number {
  return now.getFullYear() - 1;
}

export function isFilingYearLocked(
  year: number,
  isPro: boolean,
  now = new Date(),
): boolean {
  return !isPro && year === filingTaxYear(now);
}
