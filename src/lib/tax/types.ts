export type TxSide =
  | "buy"
  | "sell"
  | "transfer_in"
  | "transfer_out"
  | "income"
  | "fee"
  | "wrap";

export type TxSource = "csv" | "wallet" | "exchange";

export type PriceSource =
  | "exchange_fill"
  | "onchain"
  | "coingecko_history"
  | "coingecko_spot"
  | "csv_provided"
  | "derived_trade"
  | "manual"
  | "unknown";

export interface CryptoTx {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  asset: string;
  side: TxSide;
  quantity: number;
  /** Total JPY value of the fill / FMV. */
  jpyValue: number;
  feeJpy?: number;
  source: TxSource;
  exchange?: string;
  note?: string;
  txHash?: string;
  /** How JPY was determined (audit trail). */
  priceSource?: PriceSource;
  /** Unit JPY price used when known. */
  unitPriceJpy?: number;
  /** Counter-asset for crypto↔crypto expansion audit. */
  counterAsset?: string;
  /** Link matched exchange↔wallet hops. */
  matchedTransferId?: string;
  /** User excluded from tax calc (kept in ledger for review). */
  excluded?: boolean;
  tokenContract?: string;
  /**
   * Optional manual override (JPY total).
   * - On buy/income/transfer_in: used as acquisition cost instead of jpyValue.
   * - On sell/fee: used as 取得価額 instead of 移動平均.
   */
  costBasisOverrideJpy?: number;
}

export interface LotState {
  asset: string;
  quantity: number;
  avgCostJpy: number;
  totalCostJpy: number;
}

export interface Disposal {
  id: string;
  date: string;
  asset: string;
  quantity: number;
  proceedsJpy: number;
  costBasisJpy: number;
  gainJpy: number;
  source: TxSource;
  note?: string;
  kind: "sell" | "income" | "fee";
  priceSource?: PriceSource;
}

export interface TaxYearResult {
  year: number;
  disposals: Disposal[];
  totalProceedsJpy: number;
  totalCostBasisJpy: number;
  /** Net crypto 雑所得 (gains + income − can be negative). */
  totalGainJpy: number;
  totalPositiveGainJpy: number;
  totalLossJpy: number;
  totalIncomeJpy: number;
  endingLots: LotState[];
  txCount: number;
  activeTxCount: number;
  excludedTxCount: number;
  matchedTransferCount: number;
}

/** How much of the crypto gain sits in each national income-tax bracket. */
export interface BracketSlice {
  upTo: number;
  rate: number;
  cryptoAmountJpy: number;
  incomeTaxJpy: number;
}

export interface TaxEstimate {
  taxableGainJpy: number;
  otherIncomeJpy: number;
  totalTaxableIncomeJpy: number;
  incomeTaxJpy: number;
  reconstructionTaxJpy: number;
  residenceTaxJpy: number;
  totalTaxJpy: number;
  cryptoOnlyTaxJpy: number;
  taxWithoutCryptoJpy: number;
  taxWithCryptoJpy: number;
  cryptoIncrementalTaxJpy: number;
  effectiveRate: number;
  marginalRate: number;
  brackets: BracketSlice[];
  incomeProvided: boolean;
}

export interface TransferMatch {
  id: string;
  asset: string;
  quantity: number;
  outId: string;
  inId: string;
  outDate: string;
  inDate: string;
}
