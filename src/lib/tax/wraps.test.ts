import { isRateFlexibleWrap, isWrapPair, wrappedForm } from "./wraps";

if (!isWrapPair("ETH", "WETH") || !isWrapPair("WETH", "ETH")) {
  throw new Error("ETH↔WETH should be a wrap pair");
}
if (!isWrapPair("ETH", "STETH") || !isWrapPair("STETH", "ETH")) {
  throw new Error("ETH↔STETH should be a wrap pair");
}
if (!isWrapPair("STETH", "WSTETH")) {
  throw new Error("STETH↔WSTETH should be a wrap pair");
}
if (!isWrapPair("ETH", "RETH") || !isWrapPair("ETH", "CBETH")) {
  throw new Error("ETH↔rETH/cbETH should be wrap pairs");
}
if (isWrapPair("ETH", "USDC")) {
  throw new Error("ETH↔USDC must not be a wrap pair");
}
if (wrappedForm("ETH") !== "WETH") {
  throw new Error("canonical wrappedForm(ETH) should remain WETH");
}
if (!isRateFlexibleWrap("STETH", "WSTETH")) {
  throw new Error("stETH↔wstETH should be rate-flexible");
}
if (isRateFlexibleWrap("ETH", "STETH")) {
  throw new Error("ETH↔stETH should require ~1:1 qty");
}

console.log("wraps checks ok");
