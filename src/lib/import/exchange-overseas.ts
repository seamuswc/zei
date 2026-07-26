import { createHmac, createHash } from "crypto";
import type { CryptoTx } from "@/lib/tax/types";
import { resolveJpyUnitPrice } from "@/lib/import/prices";

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

async function quoteToJpy(
  quoteAsset: string,
  quoteAmount: number,
  date: string,
): Promise<{ jpy: number; note?: string }> {
  const q = quoteAsset.toUpperCase();
  if (q === "JPY") return { jpy: Math.round(quoteAmount) };
  // Fiat quotes without a CoinGecko id → price via USDT
  const pricedAs = q === "USD" || q === "EUR" ? "USDT" : q;
  try {
    const { jpy: unit } = await resolveJpyUnitPrice(pricedAs, date);
    return {
      jpy: Math.round(quoteAmount * unit),
      note:
        pricedAs === q
          ? `${quoteAmount} ${q}→JPY via CoinGecko`
          : `${quoteAmount} ${q}→JPY (via ${pricedAs})`,
    };
  } catch {
    throw new Error(`Cannot convert ${q} to JPY for ${date}`);
  }
}

const BINANCE_USDT_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "DOTUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "MATICUSDT",
  "ARBUSDT",
  "OPUSDT",
  "SUIUSDT",
];

const BINANCE_JPY_SYMBOLS = [
  "BTCJPY",
  "ETHJPY",
  "XRPJPY",
  "SOLJPY",
  "BNBJPY",
  "ADAJPY",
  "DOGEJPY",
  "DOTJPY",
  "MATICJPY",
  "AVAXJPY",
];

/** Shared Binance spot myTrades (JP or global). */
export async function fetchBinanceSpotTrades(options: {
  apiKey: string;
  apiSecret: string;
  symbols: string[];
  exchangeLabel: string;
  baseUrl?: string;
}): Promise<CryptoTx[]> {
  const txs: CryptoTx[] = [];
  const base = options.baseUrl || "https://api.binance.com";
  let authFailed: string | null = null;

  for (const symbol of options.symbols) {
    const timestamp = Date.now();
    const qs = `symbol=${symbol}&limit=1000&timestamp=${timestamp}`;
    const sig = createHmac("sha256", options.apiSecret).update(qs).digest("hex");
    const url = `${base}/api/v3/myTrades?${qs}&signature=${sig}`;

    const res = await fetch(url, {
      headers: { "X-MBX-APIKEY": options.apiKey },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 || res.status === 403) {
        authFailed = `${options.exchangeLabel} auth error: ${body.slice(0, 200)}`;
        break;
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

    const quote = symbol.endsWith("JPY")
      ? "JPY"
      : symbol.endsWith("USDT")
        ? "USDT"
        : symbol.endsWith("USDC")
          ? "USDC"
          : "USDT";
    const asset = symbol.replace(/USDT|USDC|JPY$/i, "").toUpperCase();

    for (const row of rows) {
      const qty = Number(row.qty);
      const quoteAmt = Number(row.quoteQty);
      if (!qty || !quoteAmt) continue;
      const date = toDate(row.time);
      const { jpy, note } = await quoteToJpy(quote, quoteAmt, date);
      const unit = qty ? jpy / qty : Number(row.price);
      txs.push({
        id: uid("bn"),
        date,
        asset,
        side: row.isBuyer ? "buy" : "sell",
        quantity: qty,
        jpyValue: jpy,
        feeJpy:
          row.commissionAsset === "JPY"
            ? Math.round(Number(row.commission))
            : undefined,
        unitPriceJpy: unit,
        priceSource: quote === "JPY" ? "exchange_fill" : "coingecko_spot",
        source: "exchange",
        exchange: options.exchangeLabel,
        note: `${row.symbol} #${row.id}${note ? ` · ${note}` : ""}`,
      });
    }
    await sleep(120);
  }

  if (authFailed) throw new Error(authFailed);
  if (txs.length === 0) {
    throw new Error(
      `${options.exchangeLabel}: no trades. Enable read-only spot history, or use CSV.`,
    );
  }
  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

export function fetchBinanceGlobalTrades(apiKey: string, apiSecret: string) {
  return fetchBinanceSpotTrades({
    apiKey,
    apiSecret,
    symbols: BINANCE_USDT_SYMBOLS,
    exchangeLabel: "Binance",
  });
}

export function fetchBinanceJpTradesShared(apiKey: string, apiSecret: string) {
  return fetchBinanceSpotTrades({
    apiKey,
    apiSecret,
    symbols: BINANCE_JPY_SYMBOLS,
    exchangeLabel: "Binance Japan",
    baseUrl: process.env.BINANCE_API_BASE || "https://api.binance.com",
  });
}

/** Bybit v5 linear/spot execution list (USDT). */
export async function fetchBybitTrades(
  apiKey: string,
  apiSecret: string,
): Promise<CryptoTx[]> {
  const txs: CryptoTx[] = [];
  const symbols = [
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "XRPUSDT",
    "BNBUSDT",
    "ADAUSDT",
    "DOGEUSDT",
    "AVAXUSDT",
  ];

  for (const symbol of symbols) {
    const timestamp = Date.now().toString();
    const query = `category=spot&symbol=${symbol}&limit=100`;
    const prehash = `${timestamp}${apiKey}5000${query}`;
    const sign = createHmac("sha256", apiSecret).update(prehash).digest("hex");

    const res = await fetch(
      `https://api.bybit.com/v5/execution/list?${query}`,
      {
        headers: {
          "X-BAPI-API-KEY": apiKey,
          "X-BAPI-SIGN": sign,
          "X-BAPI-SIGN-TYPE": "2",
          "X-BAPI-TIMESTAMP": timestamp,
          "X-BAPI-RECV-WINDOW": "5000",
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Bybit auth error: ${body.slice(0, 200)}`);
      }
      continue;
    }

    const data = (await res.json()) as {
      retCode?: number;
      retMsg?: string;
      result?: {
        list?: Array<{
          execId: string;
          symbol: string;
          side: string;
          execQty: string;
          execPrice: string;
          execValue: string;
          execTime: string;
          execFee?: string;
        }>;
      };
    };

    if (data.retCode !== 0) {
      if (/auth|permission|api key/i.test(data.retMsg || "")) {
        throw new Error(`Bybit: ${data.retMsg}`);
      }
      continue;
    }

    const asset = symbol.replace("USDT", "");
    for (const row of data.result?.list ?? []) {
      const qty = Number(row.execQty);
      const quoteAmt = Number(row.execValue);
      if (!qty || !quoteAmt) continue;
      const date = toDate(Number(row.execTime));
      const { jpy, note } = await quoteToJpy("USDT", quoteAmt, date);
      txs.push({
        id: uid("bbt"),
        date,
        asset,
        side: row.side?.toLowerCase() === "buy" ? "buy" : "sell",
        quantity: qty,
        jpyValue: jpy,
        unitPriceJpy: qty ? jpy / qty : Number(row.execPrice),
        priceSource: "coingecko_spot",
        source: "exchange",
        exchange: "Bybit",
        note: `${row.symbol} #${row.execId}${note ? ` · ${note}` : ""}`,
      });
    }
    await sleep(150);
  }

  if (txs.length === 0) {
    throw new Error(
      "Bybit returned no spot executions. Enable read-only, or use CSV.",
    );
  }
  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

/** OKX fills — requires API passphrase. */
export async function fetchOkxTrades(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
): Promise<CryptoTx[]> {
  if (!passphrase.trim()) {
    throw new Error("OKX requires API passphrase (set when creating the key).");
  }

  const timestamp = new Date().toISOString();
  const method = "GET";
  const path = "/api/v5/trade/fills?instType=SPOT&limit=100";
  const prehash = `${timestamp}${method}${path}`;
  const sign = createHmac("sha256", apiSecret)
    .update(prehash)
    .digest("base64");

  const res = await fetch(`https://www.okx.com${path}`, {
    headers: {
      "OK-ACCESS-KEY": apiKey,
      "OK-ACCESS-SIGN": sign,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": passphrase,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OKX: HTTP ${res.status} ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    code?: string;
    msg?: string;
    data?: Array<{
      tradeId: string;
      instId: string;
      side: string;
      fillSz: string;
      fillPx: string;
      fillPnl?: string;
      ts: string;
      fee?: string;
      feeCcy?: string;
    }>;
  };

  if (data.code !== "0") {
    throw new Error(`OKX: ${data.msg || data.code}`);
  }

  const txs: CryptoTx[] = [];
  for (const row of data.data ?? []) {
    const [base, quote] = row.instId.split("-");
    const qty = Number(row.fillSz);
    const px = Number(row.fillPx);
    if (!qty || !px || !base || !quote) continue;
    const date = toDate(Number(row.ts));
    const quoteAmt = qty * px;
    const { jpy, note } = await quoteToJpy(quote, quoteAmt, date);
    txs.push({
      id: uid("okx"),
      date,
      asset: base.toUpperCase(),
      side: row.side?.toLowerCase() === "buy" ? "buy" : "sell",
      quantity: qty,
      jpyValue: jpy,
      unitPriceJpy: qty ? jpy / qty : px,
      priceSource: quote === "JPY" ? "exchange_fill" : "coingecko_spot",
      source: "exchange",
      exchange: "OKX",
      note: `${row.instId} #${row.tradeId}${note ? ` · ${note}` : ""}`,
    });
  }

  if (txs.length === 0) {
    throw new Error("OKX returned no spot fills. Enable read-only trade, or use CSV.");
  }
  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

/** Kraken trade history. */
export async function fetchKrakenTrades(
  apiKey: string,
  apiSecret: string,
): Promise<CryptoTx[]> {
  const path = "/0/private/TradesHistory";
  const nonce = Date.now() * 1000;
  const body = new URLSearchParams({ nonce: String(nonce) });
  const hash = createHash("sha256")
    .update(nonce + body.toString())
    .digest();
  const secret = Buffer.from(apiSecret, "base64");
  const sign = createHmac("sha512", secret)
    .update(Buffer.concat([Buffer.from(path), hash]))
    .digest("base64");

  const res = await fetch(`https://api.kraken.com${path}`, {
    method: "POST",
    headers: {
      "API-Key": apiKey,
      "API-Sign": sign,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kraken: HTTP ${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    error?: string[];
    result?: {
      trades?: Record<
        string,
        {
          pair: string;
          type: string;
          price: string;
          vol: string;
          cost: string;
          fee: string;
          time: number;
        }
      >;
    };
  };

  if (data.error?.length) {
    throw new Error(`Kraken: ${data.error.join(", ")}`);
  }

  const txs: CryptoTx[] = [];
  for (const [id, row] of Object.entries(data.result?.trades ?? {})) {
    const qty = Number(row.vol);
    const cost = Number(row.cost);
    if (!qty || !cost) continue;
    const date = toDate(row.time);
    // Kraken pairs like XXBTZUSD, XETHZUSD, SOLUSD
    const pair = row.pair.toUpperCase();
    let asset = "BTC";
    let quote = "USD";
    if (pair.includes("XBT") || pair.startsWith("XXBT")) asset = "BTC";
    else if (pair.includes("ETH")) asset = "ETH";
    else if (pair.includes("SOL")) asset = "SOL";
    else if (pair.includes("XRP")) asset = "XRP";
    else asset = pair.replace(/USD|USDT|EUR|JPY|ZUSD|ZEUR/g, "").slice(-4) || "BTC";

    if (pair.includes("JPY")) quote = "JPY";
    else if (pair.includes("USDT")) quote = "USDT";
    else if (pair.includes("EUR")) quote = "EUR";
    else quote = "USD";

    const { jpy, note } = await quoteToJpy(quote === "USD" ? "USDT" : quote, cost, date);
    txs.push({
      id: uid("kr"),
      date,
      asset,
      side: row.type === "buy" ? "buy" : "sell",
      quantity: qty,
      jpyValue: jpy,
      feeJpy: quote === "JPY" ? Math.round(Number(row.fee)) : undefined,
      unitPriceJpy: qty ? jpy / qty : Number(row.price),
      priceSource: quote === "JPY" ? "exchange_fill" : "coingecko_spot",
      source: "exchange",
      exchange: "Kraken",
      note: `${row.pair} #${id}${note ? ` · ${note}` : ""}`,
    });
  }

  if (txs.length === 0) {
    throw new Error("Kraken returned no trades. Enable Query permission only, or use CSV.");
  }
  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

/** KuCoin fills — requires API passphrase. */
export async function fetchKucoinTrades(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
): Promise<CryptoTx[]> {
  if (!passphrase.trim()) {
    throw new Error("KuCoin requires API passphrase.");
  }

  const timestamp = Date.now().toString();
  const method = "GET";
  const endpoint = "/api/v1/fills?tradeType=TRADE&pageSize=100";
  const prehash = `${timestamp}${method}${endpoint}`;
  const sign = createHmac("sha256", apiSecret).update(prehash).digest("base64");
  const passPhrase = createHmac("sha256", apiSecret)
    .update(passphrase)
    .digest("base64");

  const res = await fetch(`https://api.kucoin.com${endpoint}`, {
    headers: {
      "KC-API-KEY": apiKey,
      "KC-API-SIGN": sign,
      "KC-API-TIMESTAMP": timestamp,
      "KC-API-PASSPHRASE": passPhrase,
      "KC-API-KEY-VERSION": "2",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`KuCoin: HTTP ${res.status} ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    code?: string;
    msg?: string;
    data?: {
      items?: Array<{
        tradeId: string;
        symbol: string;
        side: string;
        size: string;
        price: string;
        funds: string;
        fee: string;
        feeCurrency: string;
        createdAt: number;
      }>;
    };
  };

  if (data.code !== "200000") {
    throw new Error(`KuCoin: ${data.msg || data.code}`);
  }

  const txs: CryptoTx[] = [];
  for (const row of data.data?.items ?? []) {
    const [base, quote] = row.symbol.split("-");
    const qty = Number(row.size);
    const funds = Number(row.funds);
    if (!qty || !funds || !base || !quote) continue;
    const date = toDate(row.createdAt);
    const { jpy, note } = await quoteToJpy(quote, funds, date);
    txs.push({
      id: uid("kc"),
      date,
      asset: base.toUpperCase(),
      side: row.side?.toLowerCase() === "buy" ? "buy" : "sell",
      quantity: qty,
      jpyValue: jpy,
      unitPriceJpy: qty ? jpy / qty : Number(row.price),
      priceSource: quote === "JPY" ? "exchange_fill" : "coingecko_spot",
      source: "exchange",
      exchange: "KuCoin",
      note: `${row.symbol} #${row.tradeId}${note ? ` · ${note}` : ""}`,
    });
  }

  if (txs.length === 0) {
    throw new Error("KuCoin returned no fills. Enable General/Spot read only, or use CSV.");
  }
  return txs.sort((a, b) => a.date.localeCompare(b.date));
}
