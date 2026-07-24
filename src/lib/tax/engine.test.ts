import {
  allocateCryptoAcrossBrackets,
  computeMovingAverage,
  estimateJapanTax,
  summarizeTaxYear,
} from "../tax/engine";
import { matchTransfers, expandCryptoTrade } from "../tax/transfers";
import { parseSpreadsheetCsv, SAMPLE_CSV } from "../import/csv";
import { applyLossCarrySeries } from "../tax/loss-carry";
import type { CryptoTx } from "../tax/types";

const baseBuySell: CryptoTx[] = [
  {
    id: "1",
    date: "2025-01-01",
    asset: "BTC",
    side: "buy",
    quantity: 1,
    jpyValue: 1_000_000,
    source: "csv",
  },
  {
    id: "2",
    date: "2025-02-01",
    asset: "BTC",
    side: "buy",
    quantity: 1,
    jpyValue: 2_000_000,
    source: "csv",
  },
  {
    id: "3",
    date: "2025-03-01",
    asset: "BTC",
    side: "sell",
    quantity: 1,
    jpyValue: 2_500_000,
    source: "csv",
  },
];

{
  const { disposals, lots } = computeMovingAverage(baseBuySell);
  if (Math.round(disposals[0].gainJpy) !== 1_000_000) {
    throw new Error(`Expected gain 1000000, got ${disposals[0].gainJpy}`);
  }
  if (Math.round(lots.get("BTC")!.avgCostJpy) !== 1_500_000) {
    throw new Error("avg cost mismatch");
  }
}

{
  const alone = estimateJapanTax(1_000_000, 0);
  const stacked = estimateJapanTax(1_000_000, 5_000_000);
  if (stacked.totalTaxJpy <= alone.totalTaxJpy) {
    throw new Error("Stacked tax should exceed tax with ¥0 other income");
  }
  const slices = allocateCryptoAcrossBrackets(5_000_000, 1_000_000);
  if (slices.length !== 1 || slices[0].rate !== 0.2) {
    throw new Error("Expected 20% bracket slice");
  }
}

// Transfer matching + cost carry
{
  const txs: CryptoTx[] = [
    {
      id: "b",
      date: "2025-01-01",
      asset: "ETH",
      side: "buy",
      quantity: 2,
      jpyValue: 600_000,
      source: "exchange",
      exchange: "bitFlyer",
    },
    {
      id: "o",
      date: "2025-02-01",
      asset: "ETH",
      side: "transfer_out",
      quantity: 1,
      jpyValue: 0,
      source: "exchange",
    },
    {
      id: "i",
      date: "2025-02-01",
      asset: "ETH",
      side: "transfer_in",
      quantity: 1,
      jpyValue: 0,
      source: "wallet",
    },
    {
      id: "s",
      date: "2025-03-01",
      asset: "ETH",
      side: "sell",
      quantity: 1,
      jpyValue: 400_000,
      source: "wallet",
    },
  ];
  const { matches } = matchTransfers(txs);
  if (matches.length !== 1) throw new Error("expected 1 transfer match");
  const { disposals, lots } = computeMovingAverage(txs);
  // Only one sell disposal; avg cost should remain 300k
  if (disposals.length !== 1) throw new Error(`expected 1 disposal got ${disposals.length}`);
  if (Math.round(disposals[0].costBasisJpy) !== 300_000) {
    throw new Error(`cost basis expected 300000 got ${disposals[0].costBasisJpy}`);
  }
  if (Math.abs(lots.get("ETH")!.quantity - 1) > 1e-9) {
    throw new Error("expected 1 ETH remaining");
  }
}

// Income / staking
{
  const txs: CryptoTx[] = [
    {
      id: "inc",
      date: "2025-01-01",
      asset: "ETH",
      side: "income",
      quantity: 1,
      jpyValue: 50_000,
      source: "csv",
    },
    {
      id: "sell",
      date: "2025-06-01",
      asset: "ETH",
      side: "sell",
      quantity: 1,
      jpyValue: 80_000,
      source: "csv",
    },
  ];
  const summary = summarizeTaxYear(txs, 2025);
  // income 50k + sell gain 30k = 80k
  if (Math.round(summary.totalGainJpy) !== 80_000) {
    throw new Error(`income+sell expected 80000 got ${summary.totalGainJpy}`);
  }
  if (Math.round(summary.totalIncomeJpy) !== 50_000) {
    throw new Error("income total mismatch");
  }
}

// Crypto trade expansion
{
  const expanded = expandCryptoTrade({
    date: "2025-01-01",
    sellAsset: "ETH",
    sellQty: 1,
    buyAsset: "SOL",
    buyQty: 10,
    jpyValue: 100_000,
    source: "csv",
  });
  if (expanded.length !== 2) throw new Error("trade should expand to 2 txs");
  const seeded: CryptoTx[] = [
    {
      id: "e0",
      date: "2024-12-01",
      asset: "ETH",
      side: "buy",
      quantity: 1,
      jpyValue: 70_000,
      source: "csv",
    },
    ...expanded,
  ];
  const { disposals, lots } = computeMovingAverage(seeded);
  if (Math.round(disposals[0].gainJpy) !== 30_000) {
    throw new Error(`trade sell gain expected 30000 got ${disposals[0].gainJpy}`);
  }
  if (!lots.get("SOL") || Math.round(lots.get("SOL")!.totalCostJpy) !== 100_000) {
    throw new Error("SOL basis should be 100000");
  }
}

// Sample CSV parses + transfer match inside sample
{
  const { txs, errors } = parseSpreadsheetCsv(SAMPLE_CSV);
  if (errors.length) throw new Error(errors.join("; "));
  if (txs.length < 8) throw new Error("sample csv too short");
  const summary = summarizeTaxYear(txs, 2025);
  if (summary.matchedTransferCount < 1) {
    throw new Error("sample should match transfer_out/in");
  }
  // Loss year handling: net can be computed
  if (!Number.isFinite(summary.totalLossJpy)) {
    throw new Error("loss total missing");
  }
}

// Fee side realizes loss of basis
{
  const txs: CryptoTx[] = [
    {
      id: "b",
      date: "2025-01-01",
      asset: "ETH",
      side: "buy",
      quantity: 1,
      jpyValue: 100_000,
      source: "wallet",
    },
    {
      id: "f",
      date: "2025-01-02",
      asset: "ETH",
      side: "fee",
      quantity: 0.01,
      jpyValue: 1000,
      source: "wallet",
    },
  ];
  const { disposals } = computeMovingAverage(txs);
  if (disposals[0].kind !== "fee" || Math.round(disposals[0].gainJpy) !== -1000) {
    throw new Error("fee should realize -1000");
  }
}

// Sell cost override fully rebuilds remaining book
{
  const txs: CryptoTx[] = [
    {
      id: "1",
      date: "2025-01-01",
      asset: "BTC",
      side: "buy",
      quantity: 2,
      jpyValue: 2_000_000,
      source: "csv",
    },
    {
      id: "2",
      date: "2025-02-01",
      asset: "BTC",
      side: "sell",
      quantity: 1,
      jpyValue: 1_500_000,
      source: "csv",
      costBasisOverrideJpy: 800_000,
    },
  ];
  const { disposals, lots } = computeMovingAverage(txs);
  if (Math.round(disposals[0].costBasisJpy) !== 800_000) {
    throw new Error("override cost mismatch");
  }
  const lot = lots.get("BTC")!;
  if (Math.abs(lot.quantity - 1) > 1e-9) throw new Error("qty should be 1");
  if (Math.round(lot.totalCostJpy) !== 1_200_000) {
    throw new Error(
      `remaining book should be 1200000 after removing 800000 override, got ${lot.totalCostJpy}`,
    );
  }
}

// Wrap is not taxed; basis moves
{
  const txs: CryptoTx[] = [
    {
      id: "1",
      date: "2025-01-01",
      asset: "ETH",
      side: "buy",
      quantity: 1,
      jpyValue: 400_000,
      source: "csv",
    },
    {
      id: "2",
      date: "2025-02-01",
      asset: "ETH",
      side: "wrap",
      quantity: 1,
      jpyValue: 0,
      counterAsset: "WETH",
      source: "csv",
    },
    {
      id: "3",
      date: "2025-03-01",
      asset: "WETH",
      side: "sell",
      quantity: 1,
      jpyValue: 500_000,
      source: "csv",
    },
  ];
  const { disposals, lots } = computeMovingAverage(txs);
  if (disposals.length !== 1) throw new Error("wrap must not create disposal");
  if (Math.round(disposals[0].costBasisJpy) !== 400_000) {
    throw new Error("WETH should carry ETH basis");
  }
  if ((lots.get("ETH")?.quantity ?? 0) > 1e-9) throw new Error("ETH should be empty");
}

// Loss carry series
{
  const rows = applyLossCarrySeries([
    { year: 2024, netGainJpy: -200_000 },
    { year: 2025, netGainJpy: 150_000 },
    { year: 2026, netGainJpy: 100_000 },
  ]);
  if (Math.round(rows[1].taxableAfterCarryJpy) !== 0) {
    throw new Error("2025 should absorb prior loss to zero");
  }
  if (Math.round(rows[2].taxableAfterCarryJpy) !== 50_000) {
    throw new Error("2026 should have 50k after remaining carry");
  }
}

console.log("all tax/import checks ok");
