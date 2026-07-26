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
    // Kraken pairs like XXBTZUSD, XETHZUSD, SOLUSD, XBTUSDT
    const pair = row.pair.toUpperCase();
    let asset = "BTC";
    let quote = "USD";
    if (pair.includes("XBT") || pair.startsWith("XXBT")) asset = "BTC";
    else if (pair.includes("ETH")) asset = "ETH";
    else if (pair.includes("SOL")) asset = "SOL";
    else if (pair.includes("XRP")) asset = "XRP";
    else if (pair.includes("ADA")) asset = "ADA";
    else if (pair.includes("DOT")) asset = "DOT";
    else if (pair.includes("DOGE") || pair.includes("XDG")) asset = "DOGE";
    else {
      const stripped = pair.replace(/Z?USDT|Z?USD|Z?EUR|Z?JPY/g, "");
      asset = (stripped.replace(/^X/, "") || "BTC").slice(0, 6);
    }

    if (pair.includes("USDT")) quote = "USDT";
    else if (pair.includes("JPY") || pair.endsWith("ZJPY")) quote = "JPY";
    else if (pair.includes("EUR") || pair.endsWith("ZEUR")) quote = "EUR";
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

// --- Pure signing / URL helpers (unit-tested) ---

const COMMON_USDT_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "DOTUSDT",
];

const GATE_EMPTY_BODY_HASH =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

/** Bitget: HMAC-SHA256 → base64 of timestamp+METHOD+path[?query]+body */
export function signBitget(
  secret: string,
  timestamp: string,
  method: string,
  requestPath: string,
  queryString = "",
  body = "",
): string {
  const prehash =
    timestamp +
    method.toUpperCase() +
    requestPath +
    (queryString ? `?${queryString}` : "") +
    body;
  return createHmac("sha256", secret).update(prehash).digest("base64");
}

/** Gate.io v4: Hex(HMAC-SHA512(secret, METHOD\\npath\\nquery\\nSHA512(body)\\nts)) */
export function signGateV4(
  secret: string,
  method: string,
  urlPath: string,
  queryString: string,
  body: string,
  timestamp: string,
): string {
  const bodyHash = body
    ? createHash("sha512").update(body).digest("hex")
    : GATE_EMPTY_BODY_HASH;
  const signString = `${method.toUpperCase()}\n${urlPath}\n${queryString}\n${bodyHash}\n${timestamp}`;
  return createHmac("sha512", secret).update(signString).digest("hex");
}

export function gateEmptyBodyHash(): string {
  return GATE_EMPTY_BODY_HASH;
}

/** MEXC / Binance-style: Hex(HMAC-SHA256(secret, queryString)) */
export function signBinanceStyle(secret: string, totalParams: string): string {
  return createHmac("sha256", secret).update(totalParams).digest("hex");
}

/** Crypto.com Exchange: Hex(HMAC-SHA256(secret, method+id+apiKey+sortedParams+nonce)) */
export function signCryptoCom(
  secret: string,
  method: string,
  id: number | string,
  apiKey: string,
  params: Record<string, string | number>,
  nonce: number | string,
): string {
  const paramString = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + String(params[key]), "");
  const payload = `${method}${id}${apiKey}${paramString}${nonce}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Coinbase Exchange: base64(HMAC-SHA256(base64decode(secret), ts+METHOD+path+body)) */
export function signCoinbaseExchange(
  secretBase64: string,
  timestamp: string,
  method: string,
  requestPath: string,
  body = "",
): string {
  const key = Buffer.from(secretBase64, "base64");
  const prehash = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
  return createHmac("sha256", key).update(prehash).digest("base64");
}

/** HTX/Huobi: base64(HMAC-SHA256(secret, METHOD\\nhost\\npath\\nsortedQuery)) */
export function signHtx(
  secret: string,
  method: string,
  host: string,
  path: string,
  params: Record<string, string>,
): { query: string; signature: string } {
  const sorted = Object.keys(params)
    .sort()
    .map(
      (k) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`,
    )
    .join("&");
  const prehash = `${method.toUpperCase()}\n${host}\n${path}\n${sorted}`;
  const signature = createHmac("sha256", secret)
    .update(prehash)
    .digest("base64");
  return { query: sorted, signature };
}

/** Split common spot symbols: BTCUSDT, BTC_USDT, BTC-USDT, BTC-USD */
export function splitSpotSymbol(
  symbol: string,
): { asset: string; quote: string } | null {
  const s = symbol.trim().toUpperCase().replace(/\//g, "-");
  if (!s || /PERP|SWAP|-C$|-P$/i.test(s)) return null;

  const sep = s.includes("_") ? "_" : s.includes("-") ? "-" : null;
  if (sep) {
    const [asset, quote] = s.split(sep);
    if (!asset || !quote) return null;
    return { asset, quote };
  }

  for (const quote of ["USDT", "USDC", "USD", "EUR", "JPY", "BTC", "ETH"]) {
    if (s.endsWith(quote) && s.length > quote.length) {
      return { asset: s.slice(0, -quote.length), quote };
    }
  }
  return null;
}

function htxUtcTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "");
}

/** Bitget spot fills — requires API passphrase. */
export async function fetchBitgetTrades(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
): Promise<CryptoTx[]> {
  if (!passphrase.trim()) {
    throw new Error("Bitget requires API passphrase (set when creating the key).");
  }

  const path = "/api/v2/spot/trade/fills";
  const query = "limit=100";
  const timestamp = Date.now().toString();
  const sign = signBitget(apiSecret, timestamp, "GET", path, query);

  const res = await fetch(`https://api.bitget.com${path}?${query}`, {
    headers: {
      "ACCESS-KEY": apiKey,
      "ACCESS-SIGN": sign,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": passphrase,
      "Content-Type": "application/json",
      locale: "en-US",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bitget: HTTP ${res.status} ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    code?: string;
    msg?: string;
    data?: Array<{
      tradeId?: string;
      symbol?: string;
      side?: string;
      size?: string;
      priceAvg?: string;
      amount?: string;
      cTime?: string;
    }>;
  };

  if (data.code !== "00000" && data.code !== undefined && data.code !== "0") {
    throw new Error(`Bitget: ${data.msg || data.code}`);
  }

  const txs: CryptoTx[] = [];
  for (const row of data.data ?? []) {
    const parsed = splitSpotSymbol(row.symbol || "");
    if (!parsed) continue;
    const qty = Number(row.size);
    const quoteAmt = Number(row.amount) || qty * Number(row.priceAvg);
    if (!qty || !quoteAmt) continue;
    const date = toDate(Number(row.cTime));
    const { jpy, note } = await quoteToJpy(parsed.quote, quoteAmt, date);
    txs.push({
      id: uid("bg"),
      date,
      asset: parsed.asset,
      side: row.side?.toLowerCase() === "buy" ? "buy" : "sell",
      quantity: qty,
      jpyValue: jpy,
      unitPriceJpy: qty ? jpy / qty : Number(row.priceAvg),
      priceSource: parsed.quote === "JPY" ? "exchange_fill" : "coingecko_spot",
      source: "exchange",
      exchange: "Bitget",
      note: `${row.symbol} #${row.tradeId ?? ""}${note ? ` · ${note}` : ""}`,
    });
  }

  if (txs.length === 0) {
    throw new Error(
      "Bitget returned no spot fills. Enable Read-only, or use CSV.",
    );
  }
  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

/** Gate.io spot my_trades (HMAC-SHA512, no passphrase). */
export async function fetchGateioTrades(
  apiKey: string,
  apiSecret: string,
): Promise<CryptoTx[]> {
  const txs: CryptoTx[] = [];
  const pairs = COMMON_USDT_SYMBOLS.map((s) => s.replace("USDT", "_USDT"));
  let authFailed: string | null = null;

  for (const currencyPair of pairs) {
    const urlPath = "/api/v4/spot/my_trades";
    const query = `currency_pair=${currencyPair}&limit=100`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = signGateV4(apiSecret, "GET", urlPath, query, "", timestamp);

    const res = await fetch(`https://api.gateio.ws${urlPath}?${query}`, {
      headers: {
        KEY: apiKey,
        SIGN: sign,
        Timestamp: timestamp,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 || res.status === 403) {
        authFailed = `Gate.io auth error: ${body.slice(0, 200)}`;
        break;
      }
      continue;
    }

    const rows = (await res.json()) as Array<{
      id?: string;
      currency_pair?: string;
      side?: string;
      amount?: string;
      price?: string;
      create_time?: string;
      create_time_ms?: string;
    }>;

    if (!Array.isArray(rows)) continue;

    for (const row of rows) {
      const parsed = splitSpotSymbol(row.currency_pair || currencyPair);
      if (!parsed) continue;
      const qty = Number(row.amount);
      const px = Number(row.price);
      if (!qty || !px) continue;
      const quoteAmt = qty * px;
      const date = toDate(
        Number(row.create_time_ms || Number(row.create_time) * 1000),
      );
      const { jpy, note } = await quoteToJpy(parsed.quote, quoteAmt, date);
      txs.push({
        id: uid("gt"),
        date,
        asset: parsed.asset,
        side: row.side?.toLowerCase() === "buy" ? "buy" : "sell",
        quantity: qty,
        jpyValue: jpy,
        unitPriceJpy: qty ? jpy / qty : px,
        priceSource: parsed.quote === "JPY" ? "exchange_fill" : "coingecko_spot",
        source: "exchange",
        exchange: "Gate.io",
        note: `${row.currency_pair} #${row.id ?? ""}${note ? ` · ${note}` : ""}`,
      });
    }
    await sleep(120);
  }

  if (authFailed) throw new Error(authFailed);
  if (txs.length === 0) {
    throw new Error(
      "Gate.io returned no spot trades. Enable Spot read only, or use CSV.",
    );
  }
  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

/** MEXC spot myTrades (Binance-style; API window ~1 month). */
export async function fetchMexcTrades(
  apiKey: string,
  apiSecret: string,
): Promise<CryptoTx[]> {
  const txs: CryptoTx[] = [];
  let authFailed: string | null = null;

  for (const symbol of COMMON_USDT_SYMBOLS) {
    const timestamp = Date.now();
    const qs = `symbol=${symbol}&limit=100&timestamp=${timestamp}`;
    const sig = signBinanceStyle(apiSecret, qs);
    const url = `https://api.mexc.com/api/v3/myTrades?${qs}&signature=${sig}`;

    const res = await fetch(url, {
      headers: { "X-MEXC-APIKEY": apiKey },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 || res.status === 403) {
        authFailed = `MEXC auth error: ${body.slice(0, 200)}`;
        break;
      }
      continue;
    }

    const rows = (await res.json()) as Array<{
      id?: string | number;
      symbol?: string;
      qty?: string;
      quoteQty?: string;
      price?: string;
      time?: number;
      isBuyer?: boolean;
    }>;

    if (!Array.isArray(rows)) continue;
    const parsed = splitSpotSymbol(symbol);
    if (!parsed) continue;

    for (const row of rows) {
      const qty = Number(row.qty);
      const quoteAmt = Number(row.quoteQty) || qty * Number(row.price);
      if (!qty || !quoteAmt) continue;
      const date = toDate(row.time ?? 0);
      const { jpy, note } = await quoteToJpy(parsed.quote, quoteAmt, date);
      txs.push({
        id: uid("mx"),
        date,
        asset: parsed.asset,
        side: row.isBuyer ? "buy" : "sell",
        quantity: qty,
        jpyValue: jpy,
        unitPriceJpy: qty ? jpy / qty : Number(row.price),
        priceSource: "coingecko_spot",
        source: "exchange",
        exchange: "MEXC",
        note: `${row.symbol ?? symbol} #${row.id ?? ""}${note ? ` · ${note}` : ""}`,
      });
    }
    await sleep(120);
  }

  if (authFailed) throw new Error(authFailed);
  if (txs.length === 0) {
    throw new Error(
      "MEXC returned no spot trades (API covers ~1 month). Enable Spot Account Read, or use CSV.",
    );
  }
  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

/** Crypto.com Exchange private/get-trades (spot instruments only). */
export async function fetchCryptocomTrades(
  apiKey: string,
  apiSecret: string,
): Promise<CryptoTx[]> {
  const id = 1;
  const method = "private/get-trades";
  const nonce = Date.now();
  const params: Record<string, string | number> = { limit: 100 };
  const sig = signCryptoCom(apiSecret, method, id, apiKey, params, nonce);
  const body = {
    id,
    method,
    api_key: apiKey,
    params,
    nonce,
    sig,
  };

  const res = await fetch(`https://api.crypto.com/exchange/v1/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Crypto.com: HTTP ${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    code?: number;
    message?: string;
    result?: {
      data?: Array<{
        trade_id?: string;
        instrument_name?: string;
        side?: string;
        traded_quantity?: string;
        traded_price?: string;
        create_time?: number;
      }>;
    };
  };

  if (data.code !== 0 && data.code !== undefined) {
    throw new Error(`Crypto.com: ${data.message || data.code}`);
  }

  const txs: CryptoTx[] = [];
  for (const row of data.result?.data ?? []) {
    const name = row.instrument_name || "";
    if (/PERP|SWAP|-C$|-P$/i.test(name)) continue;
    const parsed = splitSpotSymbol(name);
    if (!parsed) continue;
    const qty = Number(row.traded_quantity);
    const px = Number(row.traded_price);
    if (!qty || !px) continue;
    const date = toDate(row.create_time ?? 0);
    const { jpy, note } = await quoteToJpy(parsed.quote, qty * px, date);
    txs.push({
      id: uid("cdc"),
      date,
      asset: parsed.asset,
      side: row.side?.toUpperCase() === "BUY" ? "buy" : "sell",
      quantity: qty,
      jpyValue: jpy,
      unitPriceJpy: qty ? jpy / qty : px,
      priceSource: parsed.quote === "JPY" ? "exchange_fill" : "coingecko_spot",
      source: "exchange",
      exchange: "Crypto.com",
      note: `${name} #${row.trade_id ?? ""}${note ? ` · ${note}` : ""}`,
    });
  }

  if (txs.length === 0) {
    throw new Error(
      "Crypto.com returned no spot trades. Enable read-only, or use CSV.",
    );
  }
  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Coinbase Exchange fills (HMAC + passphrase).
 * Not Coinbase Advanced Trade CDP/JWT keys — those need PEM JWT and are unsupported.
 */
export async function fetchCoinbaseTrades(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
): Promise<CryptoTx[]> {
  if (!passphrase.trim()) {
    throw new Error(
      "Coinbase Exchange requires API passphrase. (Advanced Trade JWT/CDP keys are not supported.)",
    );
  }

  const products = [
    "BTC-USD",
    "ETH-USD",
    "SOL-USD",
    "XRP-USD",
    "BTC-USDT",
    "ETH-USDT",
    "SOL-USDT",
    "BTC-USDC",
    "ETH-USDC",
  ];
  const txs: CryptoTx[] = [];
  let authFailed: string | null = null;

  for (const productId of products) {
    const requestPath = `/fills?product_id=${encodeURIComponent(productId)}&limit=100`;
    const timestamp = (Date.now() / 1000).toString();
    let sign: string;
    try {
      sign = signCoinbaseExchange(
        apiSecret,
        timestamp,
        "GET",
        requestPath,
      );
    } catch {
      throw new Error(
        "Coinbase: invalid API secret (expected Exchange base64 secret, not Advanced Trade PEM).",
      );
    }

    const res = await fetch(`https://api.exchange.coinbase.com${requestPath}`, {
      headers: {
        "CB-ACCESS-KEY": apiKey,
        "CB-ACCESS-SIGN": sign,
        "CB-ACCESS-TIMESTAMP": timestamp,
        "CB-ACCESS-PASSPHRASE": passphrase,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 || res.status === 403) {
        authFailed = `Coinbase auth error: ${body.slice(0, 200)}`;
        break;
      }
      continue;
    }

    const rows = (await res.json()) as Array<{
      trade_id?: number;
      product_id?: string;
      side?: string;
      size?: string;
      price?: string;
      created_at?: string;
    }>;

    if (!Array.isArray(rows)) continue;

    for (const row of rows) {
      const parsed = splitSpotSymbol(row.product_id || productId);
      if (!parsed) continue;
      const qty = Number(row.size);
      const px = Number(row.price);
      if (!qty || !px) continue;
      const date = toDate(row.created_at || "");
      const { jpy, note } = await quoteToJpy(parsed.quote, qty * px, date);
      txs.push({
        id: uid("cb"),
        date,
        asset: parsed.asset,
        side: row.side?.toLowerCase() === "buy" ? "buy" : "sell",
        quantity: qty,
        jpyValue: jpy,
        unitPriceJpy: qty ? jpy / qty : px,
        priceSource: parsed.quote === "JPY" ? "exchange_fill" : "coingecko_spot",
        source: "exchange",
        exchange: "Coinbase",
        note: `${row.product_id} #${row.trade_id ?? ""}${note ? ` · ${note}` : ""}`,
      });
    }
    await sleep(150);
  }

  if (authFailed) throw new Error(authFailed);
  if (txs.length === 0) {
    throw new Error(
      "Coinbase returned no fills. Use Exchange API keys (view/trade history) + passphrase — not Advanced Trade JWT. Or use CSV.",
    );
  }
  return txs.sort((a, b) => a.date.localeCompare(b.date));
}

/** HTX (Huobi) spot matchresults. */
export async function fetchHtxTrades(
  apiKey: string,
  apiSecret: string,
): Promise<CryptoTx[]> {
  const host = "api.huobi.pro";
  const path = "/v1/order/matchresults";
  const txs: CryptoTx[] = [];
  let authFailed: string | null = null;

  for (const symbol of COMMON_USDT_SYMBOLS.map((s) => s.toLowerCase())) {
    const params: Record<string, string> = {
      AccessKeyId: apiKey,
      SignatureMethod: "HmacSHA256",
      SignatureVersion: "2",
      Timestamp: htxUtcTimestamp(),
      symbol,
      size: "100",
    };
    const { query, signature } = signHtx(apiSecret, "GET", host, path, params);
    const url = `https://${host}${path}?${query}&Signature=${encodeURIComponent(signature)}`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 || res.status === 403) {
        authFailed = `HTX auth error: ${body.slice(0, 200)}`;
        break;
      }
      continue;
    }

    const data = (await res.json()) as {
      status?: string;
      "err-msg"?: string;
      data?: Array<{
        id?: number;
        "trade-id"?: number;
        symbol?: string;
        type?: string;
        "filled-amount"?: string;
        price?: string;
        "created-at"?: number;
      }>;
    };

    if (data.status && data.status !== "ok") {
      const err = data["err-msg"] || data.status;
      if (/auth|signature|permission|api.?key/i.test(err)) {
        authFailed = `HTX: ${err}`;
        break;
      }
      continue;
    }

    const parsed = splitSpotSymbol(symbol);
    if (!parsed) continue;

    for (const row of data.data ?? []) {
      const qty = Number(row["filled-amount"]);
      const px = Number(row.price);
      if (!qty || !px) continue;
      const date = toDate(row["created-at"] ?? 0);
      const { jpy, note } = await quoteToJpy(parsed.quote, qty * px, date);
      const side = /buy/i.test(row.type || "") ? "buy" : "sell";
      txs.push({
        id: uid("htx"),
        date,
        asset: parsed.asset,
        side,
        quantity: qty,
        jpyValue: jpy,
        unitPriceJpy: qty ? jpy / qty : px,
        priceSource: "coingecko_spot",
        source: "exchange",
        exchange: "HTX",
        note: `${row.symbol ?? symbol} #${row["trade-id"] ?? row.id ?? ""}${note ? ` · ${note}` : ""}`,
      });
    }
    await sleep(150);
  }

  if (authFailed) throw new Error(authFailed);
  if (txs.length === 0) {
    throw new Error(
      "HTX returned no spot fills. Enable read-only trade history, or use CSV.",
    );
  }
  return txs.sort((a, b) => a.date.localeCompare(b.date));
}
