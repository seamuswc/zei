import type { CryptoTx, PriceSource } from "@/lib/tax/types";
import {
  ERC20_SYMBOLS,
  coinIdForAsset,
  loadDailyJpySeries,
  nearestDailyJpy,
} from "@/lib/import/prices";
import { collapseWraps } from "@/lib/tax/collapse-wraps";
import {
  classifyWalletLegs,
  type WalletLeg,
} from "@/lib/import/classify-wallet";
import { EnsResolveError, resolveWalletAddress } from "@/lib/ens";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const ETH_RE = /^0x[a-fA-F0-9]{40}$/;

export function detectChain(address: string): "ethereum" | null {
  if (ETH_RE.test(address)) return "ethereum";
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

/** Per-list page size. Oldest-only truncates recent tax years on busy wallets. */
const ETHERSCAN_PAGE = "150";

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

/**
 * Fetch oldest chunk + newest chunk and merge, so early cost basis and
 * current filing years both survive the per-list cap.
 */
async function etherscanListBothEnds<T extends { hash: string; timeStamp: string }>(
  base: Record<string, string>,
  apiKey: string,
  rowKey: (row: T) => string,
): Promise<{ rows: T[]; error?: string }> {
  const oldest = (await etherscanGet(
    { ...base, page: "1", offset: ETHERSCAN_PAGE, sort: "asc" },
    apiKey,
  )) as { status: string; message: string; result: T[] | string };

  const newest = (await etherscanGet(
    { ...base, page: "1", offset: ETHERSCAN_PAGE, sort: "desc" },
    apiKey,
  )) as { status: string; message: string; result: T[] | string };

  const byKey = new Map<string, T>();
  for (const block of [oldest.result, newest.result]) {
    if (!Array.isArray(block)) continue;
    for (const row of block) byKey.set(rowKey(row), row);
  }

  if (byKey.size === 0) {
    for (const block of [oldest, newest]) {
      if (
        typeof block.result === "string" &&
        !/no transactions/i.test(block.result)
      ) {
        return {
          rows: [],
          error: block.result || block.message || "Etherscan error",
        };
      }
    }
    return { rows: [] };
  }

  return {
    rows: [...byKey.values()].sort(
      (a, b) => Number(a.timeStamp) - Number(b.timeStamp),
    ),
  };
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
  linkedAddresses: string[] = [],
): Promise<CryptoTx[]> {
  const key = etherscanApiKey.trim();
  if (!key) {
    throw new Error(
      "Server ETHERSCAN_API_KEY is not configured. Set it in the server env.",
    );
  }

  const addr = address.toLowerCase();
  const legs: WalletLeg[] = [];

  const native = await etherscanListBothEnds<EtherscanTx>(
    {
      module: "account",
      action: "txlist",
      address,
      startblock: "0",
      endblock: "99999999",
    },
    key,
    (row) => row.hash.toLowerCase(),
  );
  if (native.error) throw new Error(native.error);

  const ethDates: string[] = [];
  for (const row of native.rows) {
    if (row.isError === "1") continue;
    ethDates.push(
      new Date(Number(row.timeStamp) * 1000).toISOString().slice(0, 10),
    );
  }

  const ethSeries = await loadSeriesForCoin("ethereum", ethDates);

  for (const row of native.rows) {
    if (row.isError === "1") continue;
    const from = row.from.toLowerCase();
    const to = (row.to || "").toLowerCase();
    const date = new Date(Number(row.timeStamp) * 1000)
      .toISOString()
      .slice(0, 10);
    const { jpy, source } = priceFromSeries(ethSeries, date);

    const wei = BigInt(row.value || "0");
    // Zero-value txs are usually approve / contract calls — skip the native leg.
    // Gas fee is still recorded when we are the sender.
    if (wei > BigInt(0)) {
      const qty = Number(wei) / 1e18;
      if (qty >= 1e-8) {
        const direction =
          to === addr ? "in" : from === addr ? "out" : null;
        if (direction) {
          legs.push({
            id: uid("eth"),
            date,
            asset: "ETH",
            quantity: qty,
            jpyValue: Math.round(qty * jpy),
            unitPriceJpy: jpy,
            priceSource: source,
            direction,
            from,
            to,
            txHash: row.hash,
            walletAddress: address,
            note: `ETH · ${row.hash.slice(0, 10)}…`,
            knownAsset: true,
          });
        }
      }
    }

    if (from === addr && row.gasUsed && row.gasPrice) {
      const gasEth =
        (Number(BigInt(row.gasUsed)) * Number(BigInt(row.gasPrice))) / 1e18;
      if (gasEth > 1e-10) {
        legs.push({
          id: uid("gas"),
          date,
          asset: "ETH",
          quantity: gasEth,
          jpyValue: Math.round(gasEth * jpy),
          unitPriceJpy: jpy,
          priceSource: source,
          direction: "out",
          from,
          to: to || from,
          txHash: row.hash,
          walletAddress: address,
          note: `gas · ${row.hash.slice(0, 10)}…`,
          knownAsset: true,
          isFee: true,
        });
      }
    }
  }

  const tokens = await etherscanListBothEnds<EtherscanTokenTx>(
    {
      module: "account",
      action: "tokentx",
      address,
      startblock: "0",
      endblock: "99999999",
    },
    key,
    (row) =>
      [
        row.hash,
        row.contractAddress,
        row.from,
        row.to,
        row.value,
        row.timeStamp,
      ]
        .join(":")
        .toLowerCase(),
  );
  if (tokens.error) throw new Error(tokens.error);

  if (tokens.rows.length > 0) {
    type TokenRow = {
      row: EtherscanTokenTx;
      contract: string;
      symbol: string;
      qty: number;
      date: string;
      direction: "in" | "out";
      from: string;
      to: string;
      coinId: string | null;
      knownAsset: boolean;
    };
    const tokenRows: TokenRow[] = [];
    for (const row of tokens.rows) {
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
      const direction =
        to === addr ? "in" : from === addr ? "out" : null;
      if (!direction) continue;
      const coinId = meta?.coinId ?? coinIdForAsset(symbol);
      tokenRows.push({
        row,
        contract,
        symbol,
        qty,
        date,
        direction,
        from,
        to,
        coinId,
        knownAsset: Boolean(meta),
      });
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
      legs.push({
        id: uid("erc"),
        date: r.date,
        asset: r.symbol,
        quantity: r.qty,
        jpyValue: Math.round(r.qty * jpy),
        unitPriceJpy: jpy || undefined,
        priceSource: source,
        direction: r.direction,
        from: r.from,
        to: r.to,
        txHash: r.row.hash,
        walletAddress: address,
        note: `ERC-20 ${r.symbol} · ${r.row.hash.slice(0, 10)}…`,
        tokenContract: r.contract,
        knownAsset: r.knownAsset || Boolean(r.coinId && jpy > 0),
      });
    }
  }

  const classified = classifyWalletLegs(legs, { linkedAddresses });
  // collapseWraps still catches any residual buy+sell wrap pairs
  return collapseWraps(classified).sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchLiveWalletTxs(options: {
  address: string;
  linkedAddresses?: string[];
}): Promise<{
  address: string;
  ens?: string;
  chain: string;
  txs: CryptoTx[];
}> {
  let resolved: { address: string; ens?: string };
  try {
    resolved = await resolveWalletAddress(options.address);
  } catch (e) {
    if (e instanceof EnsResolveError) throw e;
    throw new EnsResolveError(
      "resolve_failed",
      e instanceof Error ? e.message : "ENS resolve failed",
    );
  }

  const address = resolved.address;
  const chain = detectChain(address);
  if (!chain) {
    throw new Error(
      "Enter a valid Ethereum address (0x…) or ENS name (name.eth).",
    );
  }

  const key = process.env.ETHERSCAN_API_KEY || "";
  const txs = await fetchEthereumWalletTxs(
    address,
    key,
    options.linkedAddresses ?? [],
  );
  return { address, ens: resolved.ens, chain, txs };
}
