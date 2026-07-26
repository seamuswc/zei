import { createHash, createHmac } from "crypto";
import {
  gateEmptyBodyHash,
  signBinanceStyle,
  signBitget,
  signCoinbaseExchange,
  signCryptoCom,
  signGateV4,
  signHtx,
  splitSpotSymbol,
} from "./exchange-overseas";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// --- splitSpotSymbol ---
assert(splitSpotSymbol("BTCUSDT")?.asset === "BTC", "BTCUSDT asset");
assert(splitSpotSymbol("BTCUSDT")?.quote === "USDT", "BTCUSDT quote");
assert(splitSpotSymbol("ETH_USDT")?.asset === "ETH", "ETH_USDT");
assert(splitSpotSymbol("SOL-USD")?.quote === "USD", "SOL-USD");
assert(splitSpotSymbol("BTCUSD-PERP") === null, "skip perp");
assert(splitSpotSymbol("eth/usdt")?.asset === "ETH", "slash normalize");

// --- Bitget (known vector shape) ---
{
  const ts = "1659076670000";
  const path = "/api/v2/spot/trade/fills";
  const query = "symbol=BTCUSDT&limit=20";
  const sig = signBitget("secret", ts, "GET", path, query);
  const expected = createHmac("sha256", "secret")
    .update(`${ts}GET${path}?${query}`)
    .digest("base64");
  assert(sig === expected, "Bitget sign");
}

// --- Gate.io empty body hash ---
assert(
  gateEmptyBodyHash() ===
    createHash("sha512").update("").digest("hex"),
  "Gate empty body hash",
);
{
  const ts = "1609459200";
  const path = "/api/v4/spot/my_trades";
  const query = "currency_pair=BTC_USDT&limit=50";
  const sig = signGateV4("gate-secret", "GET", path, query, "", ts);
  const bodyHash = gateEmptyBodyHash();
  const expected = createHmac("sha512", "gate-secret")
    .update(`GET\n${path}\n${query}\n${bodyHash}\n${ts}`)
    .digest("hex");
  assert(sig === expected, "Gate v4 sign");
}

// --- MEXC / Binance-style ---
{
  const qs =
    "symbol=BTCUSDT&side=BUY&type=LIMIT&quantity=1&price=11&recvWindow=5000&timestamp=1644489390087";
  const sig = signBinanceStyle(
    "45d0b3c26f2644f19bfb98b07741b2f5",
    qs,
  );
  assert(
    sig ===
      "fd3e4e8543c5188531eb7279d68ae7d26a573d0fc5ab0d18eb692451654d837a",
    "MEXC/Binance HMAC vector",
  );
}

// --- Crypto.com ---
{
  const sig = signCryptoCom(
    "secret",
    "private/get-trades",
    1,
    "key",
    { limit: 100 },
    1613570791060,
  );
  const expected = createHmac("sha256", "secret")
    .update("private/get-trades1keylimit1001613570791060")
    .digest("hex");
  assert(sig === expected, "Crypto.com sign");
}

// --- Coinbase Exchange ---
{
  const secret = Buffer.from("test-secret-bytes-pad-to-make-longer!!").toString(
    "base64",
  );
  const ts = "1632181660";
  const path = "/fills?product_id=BTC-USD&limit=100";
  const sig = signCoinbaseExchange(secret, ts, "GET", path);
  const expected = createHmac("sha256", Buffer.from(secret, "base64"))
    .update(`${ts}GET${path}`)
    .digest("base64");
  assert(sig === expected, "Coinbase Exchange sign");
}

// --- HTX ---
{
  const { query, signature } = signHtx(
    "secret",
    "GET",
    "api.huobi.pro",
    "/v1/order/matchresults",
    {
      AccessKeyId: "key",
      SignatureMethod: "HmacSHA256",
      SignatureVersion: "2",
      Timestamp: "2017-05-11T15:19:30",
      symbol: "btcusdt",
    },
  );
  assert(query.includes("AccessKeyId=key"), "HTX query has key");
  assert(query.includes("symbol=btcusdt"), "HTX query has symbol");
  assert(
    query.indexOf("AccessKeyId") < query.indexOf("Timestamp"),
    "HTX params sorted",
  );
  const prehash = `GET\napi.huobi.pro\n/v1/order/matchresults\n${query}`;
  const expected = createHmac("sha256", "secret")
    .update(prehash)
    .digest("base64");
  assert(signature === expected, "HTX sign");
}

console.log("exchange-overseas.test.ts: ok");
