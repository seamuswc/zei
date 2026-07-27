import {
  ETHERSCAN_CHAINS,
  allEtherscanChainIds,
  chainScopedKey,
  defaultWalletChainIds,
  getEtherscanChain,
  moreEtherscanChains,
  popularEtherscanChains,
  resolveWalletChainIds,
} from "./etherscan-chains";

{
  const n = ETHERSCAN_CHAINS.length;
  if (n < 20) throw new Error(`expected many mainnets, got ${n}`);
  const ids = new Set(ETHERSCAN_CHAINS.map((c) => c.id));
  if (ids.size !== n) throw new Error("duplicate chain ids in ETHERSCAN_CHAINS");
}

{
  const required = [1, 137, 42161, 10, 8453, 56, 43114, 59144];
  for (const id of required) {
    if (!getEtherscanChain(id)?.popular) {
      throw new Error(`missing popular/default chain ${id}`);
    }
  }
  const pop = popularEtherscanChains();
  if (pop.length < 5 || pop.length > 8) {
    throw new Error(`popular should be ~5–8 majors, got ${pop.length}`);
  }
  if (!pop.every((c) => c.popular)) {
    throw new Error("popularEtherscanChains returned non-popular");
  }
  for (const id of [81457, 5000, 204, 999]) {
    if (getEtherscanChain(id)?.popular) {
      throw new Error(`chain ${id} should not be popular/default`);
    }
  }
  const more = moreEtherscanChains();
  if (more.some((c) => c.popular)) {
    throw new Error("moreEtherscanChains leaked popular");
  }
  if (pop.length + more.length !== ETHERSCAN_CHAINS.length) {
    throw new Error("popular+more != all");
  }
}

{
  if (ETHERSCAN_CHAINS.some((c) => /solana/i.test(c.name))) {
    throw new Error("Solana must not be in Etherscan chains");
  }
}

{
  const a = chainScopedKey(1, "0xABC");
  const b = chainScopedKey(137, "0xABC");
  if (a !== "1:0xabc") throw new Error(`bad scope eth: ${a}`);
  if (b !== "137:0xabc") throw new Error(`bad scope poly: ${b}`);
  if (a.split(":")[1] !== b.split(":")[1] || a.split(":")[0] === b.split(":")[0]) {
    throw new Error("chain prefix must differentiate same hash across chains");
  }
}

{
  const def = defaultWalletChainIds();
  const all = allEtherscanChainIds();
  const pop = popularEtherscanChains().map((c) => c.id);
  if (all.length !== ETHERSCAN_CHAINS.length) {
    throw new Error("allEtherscanChainIds length mismatch");
  }
  if (def.join(",") !== pop.join(",")) {
    throw new Error("defaults should match popular majors");
  }
  if (def.length === all.length) {
    throw new Error("defaults must not be all Etherscan chains");
  }
  if (!def.includes(1) || !def.includes(8453) || !def.includes(42161)) {
    throw new Error("defaults should include Ethereum + Base + Arbitrum");
  }
  if (def.includes(81457) || def.includes(5000)) {
    throw new Error("defaults should skip Blast/Mantle");
  }

  const resolvedEmpty = resolveWalletChainIds([]);
  if (resolvedEmpty.join(",") !== def.join(",")) {
    throw new Error("empty chainIds should fall back to major defaults");
  }

  const resolvedNull = resolveWalletChainIds(null);
  if (resolvedNull.join(",") !== def.join(",")) {
    throw new Error("null chainIds should fall back to major defaults");
  }

  const resolved = resolveWalletChainIds([1, 1, 99999, 8453]);
  if (resolved.join(",") !== "1,8453") {
    throw new Error(`resolve filter failed: ${resolved.join(",")}`);
  }
}

{
  for (const c of ETHERSCAN_CHAINS) {
    if (!c.name?.trim()) throw new Error(`chain ${c.id} missing name`);
    if (!c.nativeSymbol?.trim()) {
      throw new Error(`chain ${c.id} missing nativeSymbol`);
    }
  }
}

console.log(
  `etherscan-chains checks ok (${ETHERSCAN_CHAINS.length} mainnets, ${popularEtherscanChains().length} default majors)`,
);
