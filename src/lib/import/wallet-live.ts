import type { CryptoTx, PriceSource } from "@/lib/tax/types";
import {
  ERC20_SYMBOLS,
  coinIdForAsset,
  loadDailyJpySeries,
  nearestDailyJpy,
} from "@/lib/import/prices";
import { collapseWraps } from "@/lib/tax/collapse-wraps";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const ETH_RE = /^0x[a-fA-F0-9]{40}$/;
const BTC_RE = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/i;

export function detectChain(
  address: string,
): "ethereum" | "bitcoin" | null {
  if (ETH_RE.test(address)) return "ethereum";
  if (BTC_RE.test(address)) return "bitcoin";
  return null;
}

interface EtherscanTx {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  isError?: string;
  gasUsed?: string;
  gasPrice?: string;
}

interface EtherscanTokenTx {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
}

async function etherscanGet(
  params: Record<string, string>,
  apiKey: string,
): Promise<unknown> {
  const q = new URLSearchParams({ ...params, apikey: apiKey });
  const v2 = `https://api.etherscan.io/v2/api?chainid=1&${q.toString()}`;
  let res = await fetch(v2, { cache: "no-store" });
  let data = (await res.json()) as {
    status: string;
    message: string;
    result: unknown;
  };
  if (Array.isArray(data.result) || data.status === "1") return data;

  const v1 = `https://api.etherscan.io/api?${q.toString()}`;
  res = await fetch(v1, { cache: "no-store" });
  data = (await res.json()) as typeof data;
  return data;
}

type Series = { byDate: Map<string, number>; source: PriceSource };

async function loadSeriesForCoin(
  coinId: string,
  dates: string[],
): Promise<Series | null> {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  try {
    return await loadDailyJpySeries(
      coinId,
      sorted[0],
      sorted[sorted.length - 1],
    );
  } catch {
    return null;
  }
}

function priceFromSeries(
  series: Series | null,
  date: string,
): { jpy: number; source: PriceSource } {
  if (!series) return { jpy: 0, source: "unknown" };
  const jpy = nearestDailyJpy(series.byDate, date);
  if (jpy == null || !(jpy > 0)) return { jpy: 0, source: "unknown" };
  return { jpy, source: series.source };
}

export async function fetchEthereumWalletTxs(
  address: string,
  etherscanApiKey: string,
): Promise<CryptoTx[]> {
  const key = etherscanApiKey.trim();
  if (!key) {
    throw new Error(
      "Server ETHERSCAN_API_KEY is not configured. Set it in the server env.",
    );
  }

  const addr = address.toLowerCase();
  const txs: CryptoTx[] = [];

  const native = (await etherscanGet(
    {
      module: "account",
      action: "txlist",
      address,
      startblock: "0",
      endblock: "99999999",
      page: "1",
      offset: "150",
      sort: "asc",
    },
    key,
  )) as { status: string; message: string; result: EtherscanTx[] | string };

  const ethDates: string[] = [];
  if (Array.isArray(native.result)) {
    for (const row of native.result) {
      if (row.isError === "1") continue;
      ethDates.push(
        new Date(Number(row.timeStamp) * 1000).toISOString().slice(0, 10),
      );
    }
  }

  const ethSeries = await loadSeriesForCoin("ethereum", ethDates);

  if (Array.isArray(native.result)) {
    for (const row of native.result) {
      if (row.isError === "1") continue;
      const wei = BigInt(row.value || "0");
      if (wei === BigInt(0)) continue;
      const qty = Number(wei) / 1e18;
      if (qty < 1e-8) continue;
      const date = new Date(Number(row.timeStamp) * 1000)
        .toISOString()
        .slice(0, 10);
      const { jpy, source } = priceFromSeries(ethSeries, date);
      const from = row.from.toLowerCase();
      const to = row.to.toLowerCase();
      const side = to === addr ? "buy" : from === addr ? "sell" : null;
      if (!side) continue;
      txs.push({
        id: uid("eth"),
        date,
        asset: "ETH",
        side,
        quantity: qty,
        jpyValue: Math.round(qty * jpy),
        unitPriceJpy: jpy,
        priceSource: source,
        source: "wallet",
        walletAddress: address,
        note: `ETH · ${row.hash.slice(0, 10)}…`,
        txHash: row.hash,
      });

      if (from === addr && row.gasUsed && row.gasPrice) {
        const gasEth =
          (Number(BigInt(row.gasUsed)) * Number(BigInt(row.gasPrice))) / 1e18;
        if (gasEth > 1e-10) {
          txs.push({
            id: uid("gas"),
            date,
            asset: "ETH",
            side: "fee",
            quantity: gasEth,
            jpyValue: Math.round(gasEth * jpy),
            unitPriceJpy: jpy,
            priceSource: source,
            source: "wallet",
            walletAddress: address,
            note: `gas · ${row.hash.slice(0, 10)}…`,
            txHash: row.hash,
          });
        }
      }
    }
  } else if (
    typeof native.result === "string" &&
    !/no transactions/i.test(native.result)
  ) {
    throw new Error(native.result || native.message || "Etherscan error");
  }

  const tokens = (await etherscanGet(
    {
      module: "account",
      action: "tokentx",
      address,
      startblock: "0",
      endblock: "99999999",
      page: "1",
      offset: "150",
      sort: "asc",
    },
    key,
  )) as {
    status: string;
    message: string;
    result: EtherscanTokenTx[] | string;
  };

  if (Array.isArray(tokens.result)) {
    type TokenRow = {
      row: EtherscanTokenTx;
      contract: string;
      symbol: string;
      qty: number;
      date: string;
      side: "buy" | "sell";
      coinId: string | null;
    };
    const tokenRows: TokenRow[] = [];
    for (const row of tokens.result) {
      const contract = row.contractAddress.toLowerCase();
      const meta = ERC20_SYMBOLS[contract];
      const symbol = (meta?.symbol || row.tokenSymbol || "TOKEN").toUpperCase();
      const decimals = meta?.decimals ?? Number(row.tokenDecimal || 18);
      const raw = BigInt(row.value || "0");
      if (raw === BigInt(0)) continue;
      const qty = Number(raw) / 10 ** decimals;
      if (qty < 1e-12) continue;
      const date = new Date(Number(row.timeStamp) * 1000)
        .toISOString()
        .slice(0, 10);
      const from = row.from.toLowerCase();
      const to = row.to.toLowerCase();
      const side = to === addr ? "buy" : from === addr ? "sell" : null;
      if (!side) continue;
      const coinId = meta?.coinId ?? coinIdForAsset(symbol);
      tokenRows.push({ row, contract, symbol, qty, date, side, coinId });
    }

    const byCoin = new Map<string, string[]>();
    for (const r of tokenRows) {
      if (!r.coinId) continue;
      const list = byCoin.get(r.coinId) ?? [];
      list.push(r.date);
      byCoin.set(r.coinId, list);
    }

    const seriesByCoin = new Map<string, Series | null>();
    for (const [coinId, dates] of byCoin) {
      seriesByCoin.set(coinId, await loadSeriesForCoin(coinId, dates));
    }

    for (const r of tokenRows) {
      const series = r.coinId ? seriesByCoin.get(r.coinId) ?? null : null;
      const { jpy, source } = priceFromSeries(series, r.date);
      txs.push({
        id: uid("erc"),
        date: r.date,
        asset: r.symbol,
        side: r.side,
        quantity: r.qty,
        jpyValue: Math.round(r.qty * jpy),
        unitPriceJpy: jpy || undefined,
        priceSource: source,
        source: "wallet",
        walletAddress: address,
        note: `ERC-20 ${r.symbol} · ${r.row.hash.slice(0, 10)}…`,
        txHash: r.row.hash,
        tokenContract: r.contract,
      });
    }
  }

  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

interface BtcTx {
  hash: string;
  time: number;
  result: number;
}

export async function fetchBitcoinWalletTxs(
  address: string,
): Promise<CryptoTx[]> {
  const url = `https://blockchain.info/rawaddr/${encodeURIComponent(address)}?limit=80`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Bitcoin explorer HTTP ${res.status}`);
  const data = (await res.json()) as { txs?: BtcTx[] };
  const txs: CryptoTx[] = [];
  const dates = (data.txs ?? []).map((row) =>
    new Date(row.time * 1000).toISOString().slice(0, 10),
  );
  const btcSeries = await loadSeriesForCoin("bitcoin", dates);

  for (const row of data.txs ?? []) {
    const sats = Number(row.result);
    if (!sats) continue;
    const qty = Math.abs(sats) / 1e8;
    if (qty < 1e-8) continue;
    const date = new Date(row.time * 1000).toISOString().slice(0, 10);
    const { jpy, source } = priceFromSeries(btcSeries, date);
    txs.push({
      id: uid("btc"),
      date,
      asset: "BTC",
      side: sats > 0 ? "buy" : "sell",
      quantity: qty,
      jpyValue: Math.round(qty * jpy),
      unitPriceJpy: jpy,
      priceSource: source,
      source: "wallet",
      walletAddress: address,
      note: `Bitcoin · ${row.hash.slice(0, 10)}…`,
      txHash: row.hash,
    });
  }

  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchLiveWalletTxs(options: {
  address: string;
}): Promise<{ address: string; chain: string; txs: CryptoTx[] }> {
  const address = options.address.trim();
  const chain = detectChain(address);
  if (!chain) {
    throw new Error("Enter a valid Ethereum (0x…) or Bitcoin address.");
  }

  if (chain === "ethereum") {
    const key = process.env.ETHERSCAN_API_KEY || "";
    const txs = await fetchEthereumWalletTxs(address, key);
    return { address, chain, txs: collapseWraps(txs) };
  }

  const txs = await fetchBitcoinWalletTxs(address);
  return { address, chain, txs: collapseWraps(txs) };
}
