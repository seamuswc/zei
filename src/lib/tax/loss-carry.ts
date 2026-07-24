/**
 * Multi-year crypto loss carry within ZEI accounts.
 *
 * Legal note (JP): 雑所得 losses usually cannot be carried forward under
 * National Tax Agency rules. This feature exists for accountant workflows /
 * planning when advised — always labeled as such in the UI/export.
 */
export type YearCarryRow = {
  year: number;
  netGainJpy: number;
  carriedInJpy: number;
  carriedOutJpy: number;
  taxableAfterCarryJpy: number;
  notes: string;
};

export function applyLossCarrySeries(
  years: { year: number; netGainJpy: number }[],
): YearCarryRow[] {
  const sorted = [...years].sort((a, b) => a.year - b.year);
  let carry = 0; // negative number means loss available
  const out: YearCarryRow[] = [];

  for (const y of sorted) {
    const carriedIn = carry; // <= 0
    const combined = y.netGainJpy + carriedIn;
    let carriedOut = 0;
    let taxable = combined;
    if (combined < 0) {
      carriedOut = combined; // push loss forward
      taxable = 0;
      carry = combined;
    } else {
      carry = 0;
      taxable = combined;
    }

    out.push({
      year: y.year,
      netGainJpy: y.netGainJpy,
      carriedInJpy: carriedIn,
      carriedOutJpy: carriedOut,
      taxableAfterCarryJpy: taxable,
      notes:
        "ZEI account loss-carry helper. JP 雑所得 generally cannot carry losses forward — confirm with 税理士.",
    });
  }

  return out;
}
