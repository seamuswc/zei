import { createHmac } from "crypto";
import type { CryptoTx } from "@/lib/tax/types";

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

/** bitFlyer private GET with HMAC headers. */
export async function fetchBitflyerExecutions(
  apiKey: string,
  apiSecret: string,
  productCodes: string[] = ["BTC_JPY", "ETH_JPY", "XRP_JPY", "SOL_JPY"],
): Promise<CryptoTx[]> {
  const txs: CryptoTx[] = [];

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
      throw new Error(
        `bitFlyer ${product}: HTTP ${res.status} ${body.slice(0, 200)}`,
      );
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
  }

  return txs.sort((a, b) => a.date.localeCompare(b.date));
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

  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

/** GMO Coin (coin.z.com) latest executions. */
export async function fetchGmoExecutions(
  apiKey: string,
  apiSecret: string,
  symbols: string[] = ["BTC", "ETH", "XRP", "SOL", "BTC_JPY", "ETH_JPY"],
): Promise<CryptoTx[]> {
  const txs: CryptoTx[] = [];

  for (const symbol of symbols) {
    const path = `/v1/latestExecutions?symbol=${encodeURIComponent(symbol)}&page=1&count=100`;
    const timestamp = Date.now().toString();
    const method = "GET";
    const text = timestamp + method + path;
    const sign = createHmac("sha256", apiSecret).update(text).digest("hex");

    const res = await fetch(`https://api.coin.z.com/private${path}`, {
      headers: {
        "API-KEY": apiKey,
        "API-TIMESTAMP": timestamp,
        "API-SIGN": sign,
      },
      cache: "no-store",
    });

    if (res.status === 404 || res.status === 400) continue;
    if (!res.ok) {
      const body = await res.text();
      // Some symbols invalid — skip soft errors
      if (res.status === 403 || res.status === 401) {
        throw new Error(`GMO Coin auth error: ${body.slice(0, 200)}`);
      }
      continue;
    }

    const data = (await res.json()) as {
      status?: number;
      data?: {
        list?: Array<{
          orderId?: number;
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
      messages?: Array<{ message_string?: string }>;
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
        note: `${row.symbol} order ${row.orderId ?? ""}`.trim(),
      });
    }
  }

  if (txs.length === 0) {
    throw new Error(
      "GMO Coin returned no executions. Check key permissions / symbols, or use CSV.",
    );
  }

  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

/** bitbank spot trade history. */
export async function fetchBitbankTrades(
  apiKey: string,
  apiSecret: string,
  pairs: string[] = ["btc_jpy", "eth_jpy", "xrp_jpy", "sol_jpy"],
): Promise<CryptoTx[]> {
  const txs: CryptoTx[] = [];

  for (const pair of pairs) {
    const path = `/v1/user/spot/trade_history`;
    const query = `pair=${pair}`;
    const nonce = Date.now().toString();
    const message = nonce + path + "?" + query; // bitbank: nonce + path for GET sometimes without body
    // Official: ACCESS-SIGNATURE = HMAC-SHA256(secret, nonce + path + requestBody)
    // For GET with query, body is empty and path includes ?query in some clients.
    // bitbank docs: message = nonce + "/v1/..." + body; query is separate in URL.
    const signPath = path; // path without query per common bitbank clients
    const sign = createHmac("sha256", apiSecret)
      .update(nonce + signPath)
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
        throw new Error(`bitbank auth error: ${body.slice(0, 200)}`);
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
      data_code?: number;
    };

    if (data.success === 0) continue;

    for (const row of data.data?.trades ?? []) {
      const side = row.side?.toLowerCase() === "buy" ? "buy" : "sell";
      const qty = Number(row.amount);
      const price = Number(row.price);
      if (!qty || !price) continue;
      const asset = pair.split("_")[0].toUpperCase();
      const jpyValue = Math.round(qty * price);
      const fee = Math.abs(Number(row.fee_amount_quote ?? 0));
      txs.push({
        id: uid("bb"),
        date: toDate(row.executed_at),
        asset,
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
  }

  if (txs.length === 0) {
    throw new Error(
      "bitbank returned no trades. Check key permissions / pairs, or use CSV.",
    );
  }

  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Binance Japan spot trades — same signing as Binance global, JP endpoint.
 * Requires API key with spot trade history permission.
 */
export async function fetchBinanceJpTrades(
  apiKey: string,
  apiSecret: string,
  symbols: string[] = ["BTCJPY", "ETHJPY", "XRPJPY", "SOLJPY"],
): Promise<CryptoTx[]> {
  const txs: CryptoTx[] = [];
  const base = "https://api.binance.com"; // JP retail often still uses mirrored endpoints; override via env

  for (const symbol of symbols) {
    const timestamp = Date.now();
    const qs = `symbol=${symbol}&limit=500&timestamp=${timestamp}`;
    const sig = createHmac("sha256", apiSecret).update(qs).digest("hex");
    const url = `${base}/api/v3/myTrades?${qs}&signature=${sig}`;

    const res = await fetch(url, {
      headers: { "X-MBX-APIKEY": apiKey },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Binance JP auth error: ${body.slice(0, 200)}`);
      }
      continue;
    }

    const rows = (await res.json()) as Array<{
      id: number;
      symbol: string;
      qty: string;
      quoteQty: string;
      price: string;
      commission: string;
      commissionAsset: string;
      time: number;
      isBuyer: boolean;
    }>;

    if (!Array.isArray(rows)) continue;
    const asset = symbol.replace("JPY", "");
    for (const row of rows) {
      const qty = Number(row.qty);
      const jpy = Math.round(Number(row.quoteQty));
      if (!qty || !jpy) continue;
      txs.push({
        id: uid("bn"),
        date: toDate(row.time),
        asset,
        side: row.isBuyer ? "buy" : "sell",
        quantity: qty,
        jpyValue: jpy,
        feeJpy:
          row.commissionAsset === "JPY"
            ? Math.round(Number(row.commission))
            : undefined,
        unitPriceJpy: Number(row.price),
        priceSource: "exchange_fill",
        source: "exchange",
        exchange: "Binance Japan",
        note: `${row.symbol} #${row.id}`,
      });
    }
  }

  if (txs.length === 0) {
    throw new Error(
      "Binance returned no JPY trades. Use Binance Japan CSV export if keys lack history.",
    );
  }

  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

export interface ExchangeDef {
  id: string;
  name: string;
  region: string;
  blurb: string;
  live: boolean;
}

export const EXCHANGES: ExchangeDef[] = [
  {
    id: "bitflyer",
    name: "bitFlyer",
    region: "Japan",
    blurb: "Live API — read-only key + secret.",
    live: true,
  },
  {
    id: "coincheck",
    name: "Coincheck",
    region: "Japan",
    blurb: "Live API — read-only key + secret.",
    live: true,
  },
  {
    id: "gmo",
    name: "GMO Coin",
    region: "Japan",
    blurb: "Live API — API key + secret (latest executions).",
    live: true,
  },
  {
    id: "bitbank",
    name: "bitbank",
    region: "Japan",
    blurb: "Live API — key + secret (spot trade history).",
    live: true,
  },
  {
    id: "binance-jp",
    name: "Binance Japan",
    region: "Japan",
    blurb: "Live API attempt (JPY pairs) — CSV fallback if empty.",
    live: true,
  },
];

export async function fetchExchangeLive(
  exchange: string,
  apiKey: string,
  apiSecret: string,
): Promise<CryptoTx[]> {
  switch (exchange) {
    case "bitflyer":
      return fetchBitflyerExecutions(apiKey, apiSecret);
    case "coincheck":
      return fetchCoincheckTransactions(apiKey, apiSecret);
    case "gmo":
      return fetchGmoExecutions(apiKey, apiSecret);
    case "bitbank":
      return fetchBitbankTrades(apiKey, apiSecret);
    case "binance-jp":
      return fetchBinanceJpTrades(apiKey, apiSecret);
    default:
      throw new Error("Unsupported exchange for live sync.");
  }
}
