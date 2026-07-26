/**
 * Smoke: load overseas helpers, validate signatures, dry-check EXCHANGES list.
 * Run: node --import tsx scripts/smoke-overseas-exchanges.mjs
 * No real API keys required.
 */
import { createHash, createHmac } from "crypto";

async function main() {
  const overseas = await import("../src/lib/import/exchange-overseas.ts");
  const live = await import("../src/lib/import/exchange-live.ts");

  const {
    signBitget,
    signGateV4,
    signBinanceStyle,
    signCryptoCom,
    signCoinbaseExchange,
    signHtx,
    splitSpotSymbol,
    gateEmptyBodyHash,
    fetchBitgetTrades,
    fetchGateioTrades,
    fetchMexcTrades,
    fetchCryptocomTrades,
    fetchCoinbaseTrades,
    fetchHtxTrades,
  } = overseas;

  const { EXCHANGES, fetchExchangeLive } = live;

  const overseasIds = [
    "binance",
    "bybit",
    "okx",
    "kraken",
    "kucoin",
    "bitget",
    "gateio",
    "mexc",
    "cryptocom",
    "coinbase",
    "htx",
  ];
  for (const id of overseasIds) {
    const def = EXCHANGES.find((e) => e.id === id);
    if (!def || def.region !== "Overseas" || !def.live) {
      throw new Error(`Missing overseas exchange def: ${id}`);
    }
  }

  for (const id of ["bitget", "coinbase", "okx", "kucoin"]) {
    const def = EXCHANGES.find((e) => e.id === id);
    if (!def?.needsPassphrase) {
      throw new Error(`${id} should need passphrase`);
    }
  }

  if (splitSpotSymbol("BTCUSDT")?.asset !== "BTC") {
    throw new Error("splitSpotSymbol failed");
  }
  if (gateEmptyBodyHash() !== createHash("sha512").update("").digest("hex")) {
    throw new Error("gateEmptyBodyHash mismatch");
  }

  const bitget = signBitget("s", "1", "GET", "/p", "a=1");
  if (
    bitget !==
    createHmac("sha256", "s").update("1GET/p?a=1").digest("base64")
  ) {
    throw new Error("signBitget mismatch");
  }

  for (const [fn, name] of [
    [() => fetchBitgetTrades("k", "s", ""), "Bitget"],
    [() => fetchCoinbaseTrades("k", "s", ""), "Coinbase"],
  ]) {
    let threw = false;
    try {
      await fn();
    } catch (e) {
      threw = /passphrase/i.test(String(e?.message || e));
    }
    if (!threw) throw new Error(`${name} should require passphrase`);
  }

  let unsupported = false;
  try {
    await fetchExchangeLive("not-an-exchange", "k", "s");
  } catch (e) {
    unsupported = /unsupported/i.test(String(e?.message || e));
  }
  if (!unsupported) throw new Error("expected unsupported exchange error");

  for (const fn of [
    fetchGateioTrades,
    fetchMexcTrades,
    fetchCryptocomTrades,
    fetchHtxTrades,
    signGateV4,
    signBinanceStyle,
    signCryptoCom,
    signCoinbaseExchange,
    signHtx,
  ]) {
    if (typeof fn !== "function") throw new Error("missing helper export");
  }

  console.log("smoke-overseas-exchanges: ok");
  console.log(
    "overseas venues:",
    EXCHANGES.filter((e) => e.region === "Overseas")
      .map((e) => e.id)
      .join(", "),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
