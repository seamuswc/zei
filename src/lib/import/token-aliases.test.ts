import {
  coinIdForAsset,
  isATokenUnderlyingPair,
  resolveCoinId,
  underlyingOfAToken,
} from "./token-aliases";

if (coinIdForAsset("LEND") !== "ethlend") {
  throw new Error("LEND should map to CoinGecko ethlend");
}
if (coinIdForAsset("AAVE") !== "aave") {
  throw new Error("AAVE should map to aave");
}
if (coinIdForAsset("ALEND") !== "ethlend") {
  throw new Error("ALEND should price via LEND → ethlend");
}
if (coinIdForAsset("AETH") !== "ethereum") {
  throw new Error("AETH should price via ETH");
}
if (coinIdForAsset("ADAI") !== "dai") {
  throw new Error("ADAI should price via DAI");
}
if (coinIdForAsset("AWETH") !== "ethereum") {
  throw new Error("AWETH should price via ETH");
}

const alend = resolveCoinId("ALEND");
if (!alend.viaUnderlying || alend.pricedAs !== "LEND") {
  throw new Error("ALEND resolve should be viaUnderlying LEND");
}
const lend = resolveCoinId("LEND");
if (lend.viaUnderlying) {
  throw new Error("LEND itself is not viaUnderlying");
}

if (!isATokenUnderlyingPair("LEND", "ALEND")) {
  throw new Error("LEND↔ALEND should be aToken pair");
}
if (!isATokenUnderlyingPair("DAI", "ADAI")) {
  throw new Error("DAI↔ADAI should be aToken pair");
}
if (!isATokenUnderlyingPair("ETH", "AETH")) {
  throw new Error("ETH↔AETH should be aToken pair");
}
if (!isATokenUnderlyingPair("WETH", "AWETH")) {
  throw new Error("WETH↔AWETH should be aToken pair");
}
if (isATokenUnderlyingPair("ETH", "USDC")) {
  throw new Error("ETH↔USDC must not be aToken pair");
}
if (underlyingOfAToken("aUsdc") !== "USDC") {
  throw new Error("case-insensitive aToken lookup failed");
}

if (coinIdForAsset("SUSHI") !== "sushi") {
  throw new Error("SUSHI should map to sushi");
}
if (coinIdForAsset("RPL") !== "rocket-pool") {
  throw new Error("RPL should map to rocket-pool");
}
if (coinIdForAsset("ASUSHI") !== "sushi") {
  throw new Error("ASUSHI should price via SUSHI");
}
if (coinIdForAsset("STETH") !== "staked-ether") {
  throw new Error("STETH should map to staked-ether");
}
if (coinIdForAsset("AREP") !== "augur") {
  throw new Error("AREP should price via REP → augur");
}

console.log("token-aliases checks ok");
