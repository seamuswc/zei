/**
 * Japan tax years that matter for filing / late filing / Pro unlock.
 * In calendar year Y: last year (Y−1) and this year (Y).
 */
export function filingTaxYears(now = new Date()): [number, number] {
  const calendarYear = now.getFullYear();
  return [calendarYear - 1, calendarYear];
}

/** Older of the two locked years (calendarYear − 1). */
export function filingTaxYear(now = new Date()): number {
  return filingTaxYears(now)[0];
}

export function isFilingYearLocked(
  year: number,
  isPro: boolean,
  now = new Date(),
): boolean {
  if (isPro) return false;
  return filingTaxYears(now).includes(year);
}
