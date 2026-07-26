import { createHmac } from "crypto";
import type { CryptoTx } from "@/lib/tax/types";
import {
  fetchBinanceGlobalTrades,
  fetchBybitTrades,
  fetchOkxTrades,
  fetchKrakenTrades,
  fetchKucoinTrades,
  fetchBinanceJpTradesShared,
  fetchBitgetTrades,
  fetchGateioTrades,
  fetchMexcTrades,
  fetchCryptocomTrades,
  fetchCoinbaseTrades,
  fetchHtxTrades,
} from "@/lib/import/exchange-overseas";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function toDate(ts: number | string): string {
  const d =
    typeof ts === "number"
      ? new Date(ts > 1e12 ? ts : ts * 1000)
      : new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** bitFlyer private GET with HMAC headers. */
export async function fetchBitflyerExecutions(
  apiKey: string,
  apiSecret: string,
  productCodes: string[] = [
    "BTC_JPY",
    "ETH_JPY",
    "XRP_JPY",
    "SOL_JPY",
    "DOT_JPY",
    "XLM_JPY",
    "MONA_JPY",
  ],
): Promise<CryptoTx[]> {
  const txs: CryptoTx[] = [];
  let authFailed: string | null = null;

  for (const product of productCodes) {
    const path = `/v1/me/getexecutions?product_code=${product}&count=500`;
    const timestamp = Date.now().toString();
    const text = `${timestamp}GET${path}`;
    const sign = createHmac("sha256", apiSecret).update(text).digest("hex");

    const res = await fetch(`https://api.bitflyer.com${path}`, {
      headers: {
        "ACCESS-KEY": apiKey,
        "ACCESS-TIMESTAMP": timestamp,
        "ACCESS-SIGN": sign,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 || res.status === 403) {
        authFailed = `bitFlyer: HTTP ${res.status} ${body.slice(0, 200)}`;
        break;
      }
      continue;
    }

    const rows = (await res.json()) as Array<{
      id: number;
      side: string;
      price: number;
      size: number;
      commission?: number;
      exec_date: string;
    }>;

    if (!Array.isArray(rows)) continue;
    const asset = product.split("_")[0];
    for (const row of rows) {
      const side = row.side?.toUpperCase() === "BUY" ? "buy" : "sell";
      const qty = Number(row.size);
      const price = Number(row.price);
      if (!qty || !price) continue;
      const jpyValue = Math.round(qty * price);
      const fee = Number(row.commission ?? 0);
      txs.push({
        id: uid("bf"),
        date: toDate(row.exec_date) || row.exec_date.slice(0, 10),
        asset,
        side,
        quantity: qty,
        jpyValue,
        feeJpy: Math.round(Math.abs(fee)),
        unitPriceJpy: price,
        priceSource: "exchange_fill",
        source: "exchange",
        exchange: "bitFlyer",
        note: `${product} exec #${row.id}`,
      });
    }
    await sleep(120);
  }

  if (authFailed) throw new Error(authFailed);
  if (txs.length === 0) {
    throw new Error(
      "bitFlyer returned no executions. Enable read-only trade history, or upload CSV.",
    );
  }

  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

/** Warn if bitFlyer key can trade/withdraw (not read-only). */
export async function checkBitflyerReadOnly(
  apiKey: string,
  apiSecret: string,
): Promise<{ ok: boolean; warning?: string }> {
  const path = "/v1/me/getpermissions";
  const timestamp = Date.now().toString();
  const sign = createHmac("sha256", apiSecret)
    .update(`${timestamp}GET${path}`)
    .digest("hex");
  const res = await fetch(`https://api.bitflyer.com${path}`, {
    headers: {
      "ACCESS-KEY": apiKey,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-SIGN": sign,
    },
    cache: "no-store",
  });
  if (!res.ok) return { ok: true };
  const perms = (await res.json()) as string[];
  if (!Array.isArray(perms)) return { ok: true };
  const risky = perms.filter(
    (p) =>
      /sendchildorder|cancelchildorder|cancelall|withdraw|sendcoin|deposit/i.test(
        p,
      ),
  );
  if (risky.length) {
    return {
      ok: false,
      warning:
        "This bitFlyer key can trade or withdraw. Create a read-only key (history/balance only).",
    };
  }
  return { ok: true };
}

/** Coincheck order transactions (JPY pairs). */
export async function fetchCoincheckTransactions(
  apiKey: string,
  apiSecret: string,
): Promise<CryptoTx[]> {
  const path = "/api/exchange/orders/transactions";
  const url = `https://coincheck.com${path}`;
  const nonce = Date.now().toString();
  const message = `${nonce}${url}`;
  const sign = createHmac("sha256", apiSecret).update(message).digest("hex");

  const res = await fetch(url, {
    headers: {
      "ACCESS-KEY": apiKey,
      "ACCESS-NONCE": nonce,
      "ACCESS-SIGNATURE": sign,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Coincheck: HTTP ${res.status} ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    success?: boolean;
    transactions?: Array<{
      id: number;
      side: string;
      pair: string;
      funds?: Record<string, string>;
      rate?: string;
      created_at: string;
    }>;
    error?: string;
  };

  if (data.success === false) {
    throw new Error(data.error || "Coincheck API error");
  }

  const txs: CryptoTx[] = [];
  for (const row of data.transactions ?? []) {
    const [base] = row.pair.split("_");
    const asset = base.toUpperCase();
    const side = row.side?.toLowerCase() === "buy" ? "buy" : "sell";
    const funds = row.funds ?? {};
    const qty = Math.abs(Number(funds[base] ?? funds[asset] ?? 0));
    const jpy = Math.abs(Number(funds.jpy ?? funds.JPY ?? 0));
    if (!qty || !jpy) continue;
    txs.push({
      id: uid("cc"),
      date: toDate(row.created_at) || row.created_at.slice(0, 10),
      asset,
      side,
      quantity: qty,
      jpyValue: Math.round(jpy),
      unitPriceJpy: qty ? jpy / qty : undefined,
      priceSource: "exchange_fill",
      source: "exchange",
      exchange: "Coincheck",
      note: `${row.pair} #${row.id}`,
    });
  }

  if (txs.length === 0) {
    throw new Error(
      "Coincheck returned no trades. Enable read-only「取引履歴」permission, or upload CSV.",
    );
  }

  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

async function gmoPrivateGet(
  apiKey: string,
  apiSecret: string,
  path: string,
  query: string,
): Promise<Response> {
  // GMO signs path WITHOUT query string (see official samples).
  const timestamp = Date.now().toString();
  const method = "GET";
  const text = timestamp + method + path;
  const sign = createHmac("sha256", apiSecret).update(text).digest("hex");
  return fetch(`https://api.coin.z.com/private${path}${query}`, {
    headers: {
      "API-KEY": apiKey,
      "API-TIMESTAMP": timestamp,
      "API-SIGN": sign,
    },
    cache: "no-store",
  });
}

/** GMO Coin (coin.z.com) latest executions (recent window; CSV for full year). */
export async function fetchGmoExecutions(
  apiKey: string,
  apiSecret: string,
  symbols: string[] = [
    "BTC",
    "ETH",
    "XRP",
    "LTC",
    "BCH",
    "SOL",
    "DOT",
    "ADA",
    "DOGE",
    "XLM",
  ],
): Promise<CryptoTx[]> {
  const txs: CryptoTx[] = [];
  let authFailed: string | null = null;

  for (const symbol of symbols) {
    const path = `/v1/latestExecutions`;
    const query = `?symbol=${encodeURIComponent(symbol)}&page=1&count=100`;
    const res = await gmoPrivateGet(apiKey, apiSecret, path, query);

    if (res.status === 404 || res.status === 400) continue;
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 403 || res.status === 401) {
        authFailed = `GMO Coin auth error: ${body.slice(0, 200)}`;
        break;
      }
      continue;
    }

    const data = (await res.json()) as {
      status?: number;
      data?: {
        list?: Array<{
          orderId?: number;
          executionId?: number;
          symbol: string;
          side: string;
          settleType?: string;
          size: string;
          price: string;
          lossGain?: string;
          fee?: string;
          timestamp: string;
        }>;
      };
    };

    if (data.status !== 0 && data.status !== undefined) continue;

    for (const row of data.data?.list ?? []) {
      const side = row.side?.toUpperCase() === "BUY" ? "buy" : "sell";
      const qty = Number(row.size);
      const price = Number(row.price);
      if (!qty || !price) continue;
      const asset = (row.symbol.includes("_")
        ? row.symbol.split("_")[0]
        : row.symbol
      ).toUpperCase();
      const jpyValue = Math.round(qty * price);
      const fee = Math.abs(Number(row.fee ?? 0));
      txs.push({
        id: uid("gmo"),
        date: toDate(row.timestamp) || row.timestamp.slice(0, 10),
        asset,
        side,
        quantity: qty,
        jpyValue,
        feeJpy: Math.round(fee),
        unitPriceJpy: price,
        priceSource: "exchange_fill",
        source: "exchange",
        exchange: "GMO Coin",
        note: `${row.symbol} exec ${row.executionId ?? row.orderId ?? ""}`.trim(),
      });
    }
    await sleep(120);
  }

  if (authFailed) throw new Error(authFailed);
  if (txs.length === 0) {
    throw new Error(
      "GMO Coin returned no recent executions (API covers a short window). Use CSV for full-year history.",
    );
  }

  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

/** bitbank spot trade history. */
export async function fetchBitbankTrades(
  apiKey: string,
  apiSecret: string,
  pairs: string[] = [
    "btc_jpy",
    "eth_jpy",
    "xrp_jpy",
    "ltc_jpy",
    "bcc_jpy",
    "mona_jpy",
    "xlm_jpy",
    "qtum_jpy",
    "bat_jpy",
    "omg_jpy",
    "link_jpy",
    "dot_jpy",
    "doge_jpy",
    "astr_jpy",
    "ada_jpy",
    "avax_jpy",
    "sol_jpy",
  ],
): Promise<CryptoTx[]> {
  const txs: CryptoTx[] = [];
  let authFailed: string | null = null;

  for (const pair of pairs) {
    const path = `/v1/user/spot/trade_history`;
    const query = `pair=${pair}`;
    const nonce = Date.now().toString();
    // Official: GET signature = HMAC(nonce + full path WITH query)
    const sign = createHmac("sha256", apiSecret)
      .update(`${nonce}${path}?${query}`)
      .digest("hex");

    const res = await fetch(`https://api.bitbank.cc${path}?${query}`, {
      headers: {
        "ACCESS-KEY": apiKey,
        "ACCESS-NONCE": nonce,
        "ACCESS-SIGNATURE": sign,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 || res.status === 403) {
        authFailed = `bitbank auth error: ${body.slice(0, 200)}`;
        break;
      }
      continue;
    }

    const data = (await res.json()) as {
      success?: number;
      data?: {
        trades?: Array<{
          trade_id: number;
          pair: string;
          order_id: number;
          side: string;
          amount: string;
          price: string;
          fee_amount_base?: string;
          fee_amount_quote?: string;
          executed_at: number;
        }>;
      };
    };

    if (data.success === 0) continue;

    for (const row of data.data?.trades ?? []) {
      const side = row.side?.toLowerCase() === "buy" ? "buy" : "sell";
      const qty = Number(row.amount);
      const price = Number(row.price);
      if (!qty || !price) continue;
      const asset = pair.split("_")[0].toUpperCase();
      const normalizedAsset = asset === "BCC" ? "BCH" : asset;
      const jpyValue = Math.round(qty * price);
      const fee = Math.abs(Number(row.fee_amount_quote ?? 0));
      txs.push({
        id: uid("bb"),
        date: toDate(row.executed_at),
        asset: normalizedAsset,
        side,
        quantity: qty,
        jpyValue,
        feeJpy: Math.round(fee),
        unitPriceJpy: price,
        priceSource: "exchange_fill",
        source: "exchange",
        exchange: "bitbank",
        note: `${row.pair} #${row.trade_id}`,
      });
    }
    await sleep(100);
  }

  if (authFailed) throw new Error(authFailed);
  if (txs.length === 0) {
    throw new Error(
      "bitbank returned no trades. Enable read-only「照会」permission, or upload CSV.",
    );
  }

  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

/** Binance Japan spot myTrades (JPY pairs) — shared overseas helper. */
export { fetchBinanceJpTradesShared as fetchBinanceJpTrades } from "@/lib/import/exchange-overseas";

/** Zaif trade history (HMAC-SHA512). */
export async function fetchZaifTrades(
  apiKey: string,
  apiSecret: string,
  pairs: string[] = [
    "btc_jpy",
    "eth_jpy",
    "xem_jpy",
    "mona_jpy",
    "bch_jpy",
    "fscc_jpy",
  ],
): Promise<CryptoTx[]> {
  const txs: CryptoTx[] = [];
  let authFailed: string | null = null;
  let nonce = Date.now() / 1000;

  for (const pair of pairs) {
    nonce += 0.01;
    const body = new URLSearchParams({
      method: "trade_history",
      nonce: String(nonce),
      currency_pair: pair,
      count: "1000",
    });
    const encoded = body.toString();
    const sign = createHmac("sha512", apiSecret).update(encoded).digest("hex");

    const res = await fetch("https://api.zaif.jp/tapi", {
      method: "POST",
      headers: {
        Key: apiKey,
        Sign: sign,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encoded,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401 || res.status === 403) {
        authFailed = `Zaif auth error: ${text.slice(0, 200)}`;
        break;
      }
      continue;
    }

    const data = (await res.json()) as {
      success?: number;
      return?: Record<
        string,
        {
          currency_pair: string;
          action: string;
          amount: number;
          price: number;
          fee?: number;
          fee_amount?: number;
          timestamp: number;
        }
      >;
      error?: string;
    };

    if (data.success === 0) {
      const err = data.error || "";
      if (/key|sign|permission|認証|権限/i.test(err)) {
        authFailed = `Zaif: ${err}`;
        break;
      }
      continue;
    }

    for (const [id, row] of Object.entries(data.return ?? {})) {
      const side = row.action === "bid" || row.action === "buy" ? "buy" : "sell";
      const qty = Number(row.amount);
      const price = Number(row.price);
      if (!qty || !price) continue;
      const asset = pair.split("_")[0].toUpperCase();
      const fee = Math.abs(Number(row.fee_amount ?? row.fee ?? 0));
      // Zaif fee on JPY pairs is often in the base asset; treat small JPY-like fees as JPY.
      const feeJpy = fee > 1 ? Math.round(fee) : undefined;
      txs.push({
        id: uid(`zf_${id}`),
        date: toDate(row.timestamp),
        asset,
        side,
        quantity: qty,
        jpyValue: Math.round(qty * price),
        feeJpy,
        unitPriceJpy: price,
        priceSource: "exchange_fill",
        source: "exchange",
        exchange: "Zaif",
        note: `${row.currency_pair} #${id}`,
      });
    }
    await sleep(250);
  }

  if (authFailed) throw new Error(authFailed);
  if (txs.length === 0) {
    throw new Error(
      "Zaif returned no trades. Enable info/trade history only (no order/withdraw), or upload CSV.",
    );
  }

  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

export type ExchangePermKey =
  | "exchange_perm_bitflyer"
  | "exchange_perm_coincheck"
  | "exchange_perm_gmo"
  | "exchange_perm_bitbank"
  | "exchange_perm_binance"
  | "exchange_perm_zaif"
  | "exchange_perm_binance_global"
  | "exchange_perm_bybit"
  | "exchange_perm_okx"
  | "exchange_perm_kraken"
  | "exchange_perm_kucoin"
  | "exchange_perm_bitget"
  | "exchange_perm_gateio"
  | "exchange_perm_mexc"
  | "exchange_perm_cryptocom"
  | "exchange_perm_coinbase"
  | "exchange_perm_htx";

export type ExchangeRegion = "Japan" | "Overseas";

export interface ExchangeDef {
  id: string;
  name: string;
  region: ExchangeRegion;
  live: boolean;
  permKey: ExchangePermKey;
  docsUrl: string;
  historyNoteKey?:
    | "exchange_hist_gmo"
    | "exchange_hist_overseas"
    | "exchange_hist_mexc"
    | "exchange_hist_coinbase";
  needsPassphrase?: boolean;
}

export const EXCHANGES: ExchangeDef[] = [
  {
    id: "bitflyer",
    name: "bitFlyer",
    region: "Japan",
    live: true,
    permKey: "exchange_perm_bitflyer",
    docsUrl: "https://lightning.bitflyer.com/developer",
  },
  {
    id: "coincheck",
    name: "Coincheck",
    region: "Japan",
    live: true,
    permKey: "exchange_perm_coincheck",
    docsUrl: "https://coincheck.com/ja/documents/exchange/api",
  },
  {
    id: "gmo",
    name: "GMO Coin",
    region: "Japan",
    live: true,
    permKey: "exchange_perm_gmo",
    docsUrl: "https://api.coin.z.com/docs/",
    historyNoteKey: "exchange_hist_gmo",
  },
  {
    id: "bitbank",
    name: "bitbank",
    region: "Japan",
    live: true,
    permKey: "exchange_perm_bitbank",
    docsUrl: "https://github.com/bitbankinc/bitbank-api-docs",
  },
  {
    id: "binance-jp",
    name: "Binance Japan",
    region: "Japan",
    live: true,
    permKey: "exchange_perm_binance",
    docsUrl: "https://www.binance.com/en/support/faq",
  },
  {
    id: "zaif",
    name: "Zaif",
    region: "Japan",
    live: true,
    permKey: "exchange_perm_zaif",
    docsUrl: "https://zaif-api-document.readthedocs.io/",
  },
  {
    id: "binance",
    name: "Binance",
    region: "Overseas",
    live: true,
    permKey: "exchange_perm_binance_global",
    docsUrl: "https://www.binance.com/en/support/faq/how-to-create-api",
    historyNoteKey: "exchange_hist_overseas",
  },
  {
    id: "bybit",
    name: "Bybit",
    region: "Overseas",
    live: true,
    permKey: "exchange_perm_bybit",
    docsUrl: "https://www.bybit.com/en/help-center/article/How-to-create-your-API-key",
    historyNoteKey: "exchange_hist_overseas",
  },
  {
    id: "okx",
    name: "OKX",
    region: "Overseas",
    live: true,
    permKey: "exchange_perm_okx",
    docsUrl: "https://www.okx.com/help/how-do-i-create-an-api-key",
    historyNoteKey: "exchange_hist_overseas",
    needsPassphrase: true,
  },
  {
    id: "kraken",
    name: "Kraken",
    region: "Overseas",
    live: true,
    permKey: "exchange_perm_kraken",
    docsUrl: "https://support.kraken.com/hc/en-us/articles/360000919966",
    historyNoteKey: "exchange_hist_overseas",
  },
  {
    id: "kucoin",
    name: "KuCoin",
    region: "Overseas",
    live: true,
    permKey: "exchange_perm_kucoin",
    docsUrl: "https://www.kucoin.com/support/360015102174",
    historyNoteKey: "exchange_hist_overseas",
    needsPassphrase: true,
  },
  {
    id: "bitget",
    name: "Bitget",
    region: "Overseas",
    live: true,
    permKey: "exchange_perm_bitget",
    docsUrl: "https://www.bitget.com/api-doc/common/intro",
    historyNoteKey: "exchange_hist_overseas",
    needsPassphrase: true,
  },
  {
    id: "gateio",
    name: "Gate.io",
    region: "Overseas",
    live: true,
    permKey: "exchange_perm_gateio",
    docsUrl: "https://www.gate.io/docs/developers/apiv4/",
    historyNoteKey: "exchange_hist_overseas",
  },
  {
    id: "mexc",
    name: "MEXC",
    region: "Overseas",
    live: true,
    permKey: "exchange_perm_mexc",
    docsUrl: "https://www.mexc.com/api-docs/spot-v3/introduction",
    historyNoteKey: "exchange_hist_mexc",
  },
  {
    id: "cryptocom",
    name: "Crypto.com",
    region: "Overseas",
    live: true,
    permKey: "exchange_perm_cryptocom",
    docsUrl: "https://exchange-docs.crypto.com/exchange/v1/rest-ws/index.html",
    historyNoteKey: "exchange_hist_overseas",
  },
  {
    id: "coinbase",
    name: "Coinbase",
    region: "Overseas",
    live: true,
    permKey: "exchange_perm_coinbase",
    docsUrl: "https://docs.cdp.coinbase.com/exchange/docs/welcome",
    historyNoteKey: "exchange_hist_coinbase",
    needsPassphrase: true,
  },
  {
    id: "htx",
    name: "HTX",
    region: "Overseas",
    live: true,
    permKey: "exchange_perm_htx",
    docsUrl: "https://www.htx.com/en-us/opend/newApiPages/",
    historyNoteKey: "exchange_hist_overseas",
  },
];

export async function fetchExchangeLive(
  exchange: string,
  apiKey: string,
  apiSecret: string,
  passphrase?: string,
): Promise<{ txs: CryptoTx[]; warning?: string }> {
  let warning: string | undefined;

  switch (exchange) {
    case "bitflyer": {
      const check = await checkBitflyerReadOnly(apiKey, apiSecret);
      if (!check.ok) warning = check.warning;
      return { txs: await fetchBitflyerExecutions(apiKey, apiSecret), warning };
    }
    case "coincheck":
      return { txs: await fetchCoincheckTransactions(apiKey, apiSecret) };
    case "gmo":
      return { txs: await fetchGmoExecutions(apiKey, apiSecret) };
    case "bitbank":
      return { txs: await fetchBitbankTrades(apiKey, apiSecret) };
    case "binance-jp":
      return { txs: await fetchBinanceJpTradesShared(apiKey, apiSecret) };
    case "zaif":
      return { txs: await fetchZaifTrades(apiKey, apiSecret) };
    case "binance":
      return { txs: await fetchBinanceGlobalTrades(apiKey, apiSecret) };
    case "bybit":
      return { txs: await fetchBybitTrades(apiKey, apiSecret) };
    case "okx":
      return {
        txs: await fetchOkxTrades(apiKey, apiSecret, passphrase || ""),
      };
    case "kraken":
      return { txs: await fetchKrakenTrades(apiKey, apiSecret) };
    case "kucoin":
      return {
        txs: await fetchKucoinTrades(apiKey, apiSecret, passphrase || ""),
      };
    case "bitget":
      return {
        txs: await fetchBitgetTrades(apiKey, apiSecret, passphrase || ""),
      };
    case "gateio":
      return { txs: await fetchGateioTrades(apiKey, apiSecret) };
    case "mexc":
      return { txs: await fetchMexcTrades(apiKey, apiSecret) };
    case "cryptocom":
      return { txs: await fetchCryptocomTrades(apiKey, apiSecret) };
    case "coinbase":
      return {
        txs: await fetchCoinbaseTrades(apiKey, apiSecret, passphrase || ""),
      };
    case "htx":
      return { txs: await fetchHtxTrades(apiKey, apiSecret) };
    default:
      throw new Error("Unsupported exchange for live sync.");
  }
}
