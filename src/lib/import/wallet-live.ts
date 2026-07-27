import type { CryptoTx, PriceSource } from "@/lib/tax/types";
import {
  ERC20_SYMBOLS,
  resolveCoinId,
  loadDailyJpySeries,
  nearestDailyJpy,
} from "@/lib/import/prices";
import { isAToken } from "@/lib/import/token-aliases";
import { collapseWraps } from "@/lib/tax/collapse-wraps";
import {
  classifyWalletLegs,
  type WalletLeg,
} from "@/lib/import/classify-wallet";
import { EnsResolveError, resolveWalletAddress } from "@/lib/ens";
import { tokyoDateFromTs } from "@/lib/dates";
import {
  type EtherscanChain,
  chainLabelForIds,
  chainScopedKey,
  getEtherscanChain,
  resolveWalletChainIds,
} from "@/lib/import/etherscan-chains";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const ETH_RE = /^0x[a-fA-F0-9]{40}$/;

export function detectChain(address: string): "evm" | null {
  if (ETH_RE.test(address)) return "evm";
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
  type?: string;
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
  chainId: number,
  params: Record<string, string>,
  apiKey: string,
): Promise<unknown> {
  const q = new URLSearchParams({
    chainid: String(chainId),
    ...params,
    apikey: apiKey,
  });
  const url = `https://api.etherscan.io/v2/api?${q.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  return (await res.json()) as {
    status: string;
    message: string;
    result: unknown;
  };
}

type Series = { byDate: Map<string, number>; source: PriceSource };

/** Per-list page size. Paginate until empty or MAX_PAGES. */
const ETHERSCAN_PAGE = 150;
const ETHERSCAN_MAX_PAGES = 20;
/** Soft concurrency for full history fetch (rate-limit aware). */
const CHAIN_CONCURRENCY = 2;
/** Higher concurrency for empty/activity probes (1 page each). */
const PROBE_CONCURRENCY = 6;
/**
 * Soft wall-clock budget for multi-chain sync. Leave headroom under nginx
 * proxy_read_timeout (600s) and typical edge proxies so we return partial
 * JSON instead of a hard 502/504 HTML error page.
 */
const SYNC_DEADLINE_MS = 270_000;
const DEADLINE_SKIP_MSG = "Skipped — sync deadline reached (partial import)";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function msLeft(startedAt: number, deadlineMs: number): number {
  return deadlineMs - (Date.now() - startedAt);
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  opts?: {
    startedAt?: number;
    deadlineMs?: number;
    /** Called for items not started before the deadline. */
    onSkip?: (item: T, index: number) => R;
  },
): Promise<{ results: R[]; skipped: number }> {
  const results = new Array<R>(items.length);
  let next = 0;
  let skipped = 0;
  const startedAt = opts?.startedAt;
  const deadlineMs = opts?.deadlineMs;
  const onSkip = opts?.onSkip;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      if (
        startedAt != null &&
        deadlineMs != null &&
        onSkip &&
        msLeft(startedAt, deadlineMs) <= 0
      ) {
        results[i] = onSkip(items[i], i);
        skipped++;
        continue;
      }
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.min(Math.max(1, concurrency), Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return { results, skipped };
}

/** Popular chains first, then the rest (stable within each group). */
function orderChainsPopularFirst(chains: EtherscanChain[]): EtherscanChain[] {
  const popular = chains.filter((c) => c.popular);
  const rest = chains.filter((c) => !c.popular);
  return [...popular, ...rest];
}

/**
 * Cheap activity probe: one page (offset 1) of native / token / internal.
 * Empty chains exit in ~3 API calls instead of full pagination + pricing.
 */
async function probeChainActivity(
  chainId: number,
  address: string,
  apiKey: string,
): Promise<{ active: boolean; error?: string }> {
  const probe = async (action: string) =>
    (await etherscanGet(
      chainId,
      {
        module: "account",
        action,
        address,
        startblock: "0",
        endblock: "99999999",
        page: "1",
        offset: "1",
        sort: "desc",
      },
      apiKey,
    )) as { status: string; message: string; result: unknown };

  const native = await probe("txlist");
  if (Array.isArray(native.result) && native.result.length > 0) {
    return { active: true };
  }
  if (
    typeof native.result === "string" &&
    !/no transactions/i.test(native.result)
  ) {
    // Rate-limit / API errors — treat as active so full sync can surface the error.
    if (!/^(?:0|)$/.test(native.result.trim())) {
      return { active: true, error: native.result || native.message };
    }
  }

  const tokens = await probe("tokentx");
  if (Array.isArray(tokens.result) && tokens.result.length > 0) {
    return { active: true };
  }

  const internal = await probe("txlistinternal");
  if (Array.isArray(internal.result) && internal.result.length > 0) {
    return { active: true };
  }

  return { active: false };
}

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
 * Paginate an Etherscan account list (asc) until a short page or max pages.
 * `truncated` is true when page MAX still returned a full page (history may continue).
 */
async function etherscanListPaged<T extends { hash: string; timeStamp: string }>(
  chainId: number,
  base: Record<string, string>,
  apiKey: string,
  rowKey: (row: T) => string,
): Promise<{ rows: T[]; truncated: boolean; error?: string }> {
  const byKey = new Map<string, T>();
  let truncated = false;
  let lastError: string | undefined;

  for (let page = 1; page <= ETHERSCAN_MAX_PAGES; page++) {
    const data = (await etherscanGet(
      chainId,
      {
        ...base,
        page: String(page),
        offset: String(ETHERSCAN_PAGE),
        sort: "asc",
      },
      apiKey,
    )) as { status: string; message: string; result: T[] | string };

    if (!Array.isArray(data.result)) {
      if (
        typeof data.result === "string" &&
        !/no transactions/i.test(data.result)
      ) {
        lastError = data.result || data.message || "Etherscan error";
      }
      break;
    }

    if (data.result.length === 0) break;

    for (const row of data.result) byKey.set(rowKey(row), row);

    if (data.result.length < ETHERSCAN_PAGE) break;
    if (page === ETHERSCAN_MAX_PAGES) {
      truncated = true;
      break;
    }
    // Soft pacing for free-tier Etherscan keys
    await sleep(220);
  }

  if (byKey.size === 0 && lastError) {
    return { rows: [], truncated: false, error: lastError };
  }

  return {
    rows: [...byKey.values()].sort(
      (a, b) => Number(a.timeStamp) - Number(b.timeStamp),
    ),
    truncated,
  };
}

function priceFromSeries(
  series: Series | null,
  date: string,
  viaUnderlying = false,
): { jpy: number; source: PriceSource } {
  if (!series) return { jpy: 0, source: "unknown" };
  const jpy = nearestDailyJpy(series.byDate, date);
  if (jpy == null || !(jpy > 0)) return { jpy: 0, source: "unknown" };
  if (viaUnderlying) return { jpy, source: "coingecko_underlying" };
  return { jpy, source: series.source };
}

export type WalletSyncMeta = {
  truncated: boolean;
  chainLabel: string;
};

export type ChainSyncResult = {
  chainId: number;
  chainName: string;
  txs: CryptoTx[];
  truncated: boolean;
  error?: string;
};

/**
 * Fetch native + internal + ERC-20 history for one Etherscan V2 chain.
 */
export async function fetchWalletTxsForChain(
  address: string,
  chain: EtherscanChain,
  etherscanApiKey: string,
  linkedAddresses: string[] = [],
): Promise<{ txs: CryptoTx[]; truncated: boolean }> {
  const key = etherscanApiKey.trim();
  if (!key) {
    throw new Error(
      "Server ETHERSCAN_API_KEY is not configured. Set it in the server env.",
    );
  }

  const addr = address.toLowerCase();
  const chainId = chain.id;
  const nativeSym = chain.nativeSymbol;
  const legs: WalletLeg[] = [];
  let anyTruncated = false;

  const native = await etherscanListPaged<EtherscanTx>(
    chainId,
    {
      module: "account",
      action: "txlist",
      address,
      startblock: "0",
      endblock: "99999999",
    },
    key,
    (row) => chainScopedKey(chainId, row.hash),
  );
  if (native.error) throw new Error(native.error);
  anyTruncated = anyTruncated || native.truncated;

  const internal = await etherscanListPaged<EtherscanTx>(
    chainId,
    {
      module: "account",
      action: "txlistinternal",
      address,
      startblock: "0",
      endblock: "99999999",
    },
    key,
    (row) =>
      chainScopedKey(
        chainId,
        [
          row.hash,
          row.from,
          row.to,
          row.value,
          row.timeStamp,
          row.type ?? "",
        ].join(":"),
      ),
  );
  // Internal can fail on some keys/chains — treat as empty rather than aborting
  if (!internal.error) {
    anyTruncated = anyTruncated || internal.truncated;
  }

  const nativeDates: string[] = [];
  const nativeAndInternal = [
    ...native.rows,
    ...(internal.error ? [] : internal.rows),
  ];
  for (const row of nativeAndInternal) {
    if (row.isError === "1") continue;
    nativeDates.push(tokyoDateFromTs(Number(row.timeStamp)));
  }

  const nativeSeries = chain.coinId
    ? await loadSeriesForCoin(chain.coinId, nativeDates)
    : null;

  for (const row of native.rows) {
    if (row.isError === "1") continue;
    const from = row.from.toLowerCase();
    const to = (row.to || "").toLowerCase();
    const date = tokyoDateFromTs(Number(row.timeStamp));
    const { jpy, source } = priceFromSeries(nativeSeries, date);
    const scopedHash = chainScopedKey(chainId, row.hash);

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
            id: uid(`n${chainId}`),
            date,
            asset: nativeSym,
            quantity: qty,
            jpyValue: Math.round(qty * jpy),
            unitPriceJpy: jpy,
            priceSource: source,
            direction,
            from,
            to,
            txHash: scopedHash,
            walletAddress: addr,
            note: `${chain.name} ${nativeSym} · ${row.hash.slice(0, 10)}…`,
            knownAsset: Boolean(chain.coinId),
          });
        }
      }
    }

    if (from === addr && row.gasUsed && row.gasPrice) {
      const gasQty =
        (Number(BigInt(row.gasUsed)) * Number(BigInt(row.gasPrice))) / 1e18;
      if (gasQty > 1e-10) {
        legs.push({
          id: uid(`g${chainId}`),
          date,
          asset: nativeSym,
          quantity: gasQty,
          jpyValue: Math.round(gasQty * jpy),
          unitPriceJpy: jpy,
          priceSource: source,
          direction: "out",
          from,
          to: to || from,
          txHash: scopedHash,
          walletAddress: addr,
          note: `${chain.name} gas · ${row.hash.slice(0, 10)}…`,
          knownAsset: Boolean(chain.coinId),
          isFee: true,
        });
      }
    }
  }

  // Internal native transfers (contract → wallet, etc.) — no gas on these rows
  if (!internal.error) {
    for (const row of internal.rows) {
      if (row.isError === "1") continue;
      const from = row.from.toLowerCase();
      const to = (row.to || "").toLowerCase();
      const date = tokyoDateFromTs(Number(row.timeStamp));
      const { jpy, source } = priceFromSeries(nativeSeries, date);
      const wei = BigInt(row.value || "0");
      if (wei <= BigInt(0)) continue;
      const qty = Number(wei) / 1e18;
      if (qty < 1e-8) continue;
      const direction =
        to === addr ? "in" : from === addr ? "out" : null;
      if (!direction) continue;
      legs.push({
        id: uid(`i${chainId}`),
        date,
        asset: nativeSym,
        quantity: qty,
        jpyValue: Math.round(qty * jpy),
        unitPriceJpy: jpy,
        priceSource: source,
        direction,
        from,
        to,
        txHash: chainScopedKey(chainId, row.hash),
        walletAddress: addr,
        note: `${chain.name} ${nativeSym} internal · ${row.hash.slice(0, 10)}…`,
        knownAsset: Boolean(chain.coinId),
      });
    }
  }

  const tokens = await etherscanListPaged<EtherscanTokenTx>(
    chainId,
    {
      module: "account",
      action: "tokentx",
      address,
      startblock: "0",
      endblock: "99999999",
    },
    key,
    (row) =>
      chainScopedKey(
        chainId,
        [
          row.hash,
          row.contractAddress,
          row.from,
          row.to,
          row.value,
          row.timeStamp,
        ].join(":"),
      ),
  );
  if (tokens.error) throw new Error(tokens.error);
  anyTruncated = anyTruncated || tokens.truncated;

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
      viaUnderlying: boolean;
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
      const date = tokyoDateFromTs(Number(row.timeStamp));
      const from = row.from.toLowerCase();
      const to = row.to.toLowerCase();
      const direction =
        to === addr ? "in" : from === addr ? "out" : null;
      if (!direction) continue;
      const resolved = resolveCoinId(symbol);
      const coinId = meta?.coinId ?? resolved.coinId;
      const viaUnderlying =
        Boolean(coinId) && (resolved.viaUnderlying || isAToken(symbol));
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
        viaUnderlying,
        knownAsset: Boolean(meta) || Boolean(coinId),
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
      const { jpy, source } = priceFromSeries(
        series,
        r.date,
        r.viaUnderlying,
      );
      legs.push({
        id: uid(`t${chainId}`),
        date: r.date,
        asset: r.symbol,
        quantity: r.qty,
        jpyValue: Math.round(r.qty * jpy),
        unitPriceJpy: jpy || undefined,
        priceSource: source,
        direction: r.direction,
        from: r.from,
        to: r.to,
        txHash: chainScopedKey(chainId, r.row.hash),
        walletAddress: addr,
        note: `${chain.name} ERC-20 ${r.symbol} · ${r.row.hash.slice(0, 10)}…`,
        tokenContract: r.contract,
        knownAsset: r.knownAsset || Boolean(r.coinId && jpy > 0),
      });
    }
  }

  const classified = classifyWalletLegs(legs, { linkedAddresses });
  return {
    txs: collapseWraps(classified).sort((a, b) => a.date.localeCompare(b.date)),
    truncated: anyTruncated,
  };
}

/** @deprecated Prefer fetchWalletTxsForChain — kept for call-sites expecting ETH-only. */
export async function fetchEthereumWalletTxs(
  address: string,
  etherscanApiKey: string,
  linkedAddresses: string[] = [],
): Promise<{ txs: CryptoTx[]; truncated: boolean }> {
  const eth = getEtherscanChain(1);
  if (!eth) throw new Error("Ethereum chain missing from ETHERSCAN_CHAINS");
  return fetchWalletTxsForChain(
    address,
    eth,
    etherscanApiKey,
    linkedAddresses,
  );
}

export async function fetchLiveWalletTxs(options: {
  address: string;
  linkedAddresses?: string[];
  /** Etherscan V2 chain ids. Empty/omitted → ETH + major L2 defaults. */
  chainIds?: number[];
  /** Soft wall-clock budget in ms (default SYNC_DEADLINE_MS). */
  deadlineMs?: number;
}): Promise<{
  address: string;
  ens?: string;
  chain: string;
  chainLabel: string;
  /** Chains that returned at least one tx (for linked-wallet display). */
  chainIds: number[];
  chainsSynced: Array<{
    chainId: number;
    name: string;
    count: number;
    truncated: boolean;
    error?: string;
  }>;
  truncated: boolean;
  /** True when some chains were skipped because the soft deadline was hit. */
  partial: boolean;
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

  const chainIds = resolveWalletChainIds(options.chainIds);
  const chains = orderChainsPopularFirst(
    chainIds
      .map((id) => getEtherscanChain(id))
      .filter((c): c is EtherscanChain => Boolean(c)),
  );

  const key = process.env.ETHERSCAN_API_KEY || "";
  const linked = options.linkedAddresses ?? [];
  const startedAt = Date.now();
  const deadlineMs = options.deadlineMs ?? SYNC_DEADLINE_MS;

  // Phase 1 — probe activity quickly (skip empty chains before pagination/pricing).
  const { results: probes, skipped: probeSkipped } = await mapPool(
    chains,
    PROBE_CONCURRENCY,
    async (c) => {
      try {
        const probe = await probeChainActivity(c.id, address, key);
        return { chain: c, ...probe };
      } catch (e) {
        // Probe failure → attempt full sync so we don't silently drop the chain.
        return {
          chain: c,
          active: true,
          error: e instanceof Error ? e.message : "Probe failed",
        };
      }
    },
    {
      startedAt,
      deadlineMs,
      onSkip: (c) => ({
        chain: c,
        active: false,
        error: DEADLINE_SKIP_MSG,
      }),
    },
  );

  const emptyResults: ChainSyncResult[] = [];
  const toFetch: EtherscanChain[] = [];
  for (const p of probes) {
    if (p.error === DEADLINE_SKIP_MSG) {
      emptyResults.push({
        chainId: p.chain.id,
        chainName: p.chain.name,
        txs: [],
        truncated: false,
        error: DEADLINE_SKIP_MSG,
      });
      continue;
    }
    if (!p.active) {
      emptyResults.push({
        chainId: p.chain.id,
        chainName: p.chain.name,
        txs: [],
        truncated: false,
      });
      continue;
    }
    toFetch.push(p.chain);
  }

  // Phase 2 — full history for active chains only (popular already first).
  const { results: fetched, skipped: fetchSkipped } = await mapPool(
    toFetch,
    CHAIN_CONCURRENCY,
    async (c) => {
      try {
        const { txs, truncated } = await fetchWalletTxsForChain(
          address,
          c,
          key,
          linked,
        );
        return {
          chainId: c.id,
          chainName: c.name,
          txs,
          truncated,
        } satisfies ChainSyncResult;
      } catch (e) {
        return {
          chainId: c.id,
          chainName: c.name,
          txs: [],
          truncated: false,
          error: e instanceof Error ? e.message : "Chain sync failed",
        } satisfies ChainSyncResult;
      }
    },
    {
      startedAt,
      deadlineMs,
      onSkip: (c) =>
        ({
          chainId: c.id,
          chainName: c.name,
          txs: [],
          truncated: false,
          error: DEADLINE_SKIP_MSG,
        }) satisfies ChainSyncResult,
    },
  );

  // Preserve popular-first order from the original chain list.
  const byId = new Map<number, ChainSyncResult>();
  for (const r of emptyResults) byId.set(r.chainId, r);
  for (const r of fetched) byId.set(r.chainId, r);
  const perChain = chains.map(
    (c) =>
      byId.get(c.id) ?? {
        chainId: c.id,
        chainName: c.name,
        txs: [],
        truncated: false,
        error: DEADLINE_SKIP_MSG,
      },
  );

  const txs = perChain
    .flatMap((r) => r.txs)
    .sort((a, b) => a.date.localeCompare(b.date));

  const activityIds = perChain
    .filter((r) => !r.error && r.txs.length > 0)
    .map((r) => r.chainId);

  const anyTruncated = perChain.some((r) => r.truncated);
  const partial =
    probeSkipped > 0 ||
    fetchSkipped > 0 ||
    perChain.some((r) => r.error === DEADLINE_SKIP_MSG);

  const hardFail =
    perChain.length > 0 &&
    perChain.every((r) => r.error && r.error !== DEADLINE_SKIP_MSG);
  if (hardFail) {
    throw new Error(
      perChain[0]?.error || "Wallet sync failed on all selected chains.",
    );
  }

  // Partial with zero txs and only deadline skips → still return OK so client
  // can show a clear mid-sync message instead of a hard 502/504.
  return {
    address,
    ens: resolved.ens,
    chain: "evm",
    chainLabel: chainLabelForIds(activityIds.length ? activityIds : chainIds),
    chainIds: activityIds,
    chainsSynced: perChain.map((r) => ({
      chainId: r.chainId,
      name: r.chainName,
      count: r.txs.length,
      truncated: r.truncated,
      error: r.error,
    })),
    truncated: anyTruncated,
    partial,
    txs,
  };
}
