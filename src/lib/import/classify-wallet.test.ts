import {
  classifyWalletLegs,
  type WalletLeg,
} from "./classify-wallet";

const WALLET = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";
const AAVE_V3 = "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2";
const UNI_AIRDROP = "0x090d4613473dee047c3f2706764f04e5131672bd";
const DEX = "0x3333333333333333333333333333333333333333";

function leg(partial: Partial<WalletLeg> & Pick<WalletLeg, "id" | "asset" | "direction" | "quantity">): WalletLeg {
  const direction = partial.direction;
  const from =
    partial.from ??
    (direction === "out" ? WALLET : DEX);
  const to =
    partial.to ??
    (direction === "out" ? DEX : WALLET);
  return {
    date: "2025-06-01",
    jpyValue: 0,
    txHash: "0xabc",
    walletAddress: WALLET,
    knownAsset: true,
    from,
    to,
    ...partial,
  };
}

// Swap: ETH out + USDC in → shared JPY sell+buy
{
  const txs = classifyWalletLegs([
    leg({
      id: "o",
      asset: "ETH",
      direction: "out",
      quantity: 1,
      jpyValue: 400_000,
      unitPriceJpy: 400_000,
      from: WALLET,
      to: DEX,
    }),
    leg({
      id: "i",
      asset: "USDC",
      direction: "in",
      quantity: 2500,
      jpyValue: 375_000,
      from: DEX,
      to: WALLET,
    }),
    leg({
      id: "g",
      asset: "ETH",
      direction: "out",
      quantity: 0.001,
      jpyValue: 400,
      isFee: true,
      from: WALLET,
      to: DEX,
    }),
  ]);
  const sell = txs.find((t) => t.side === "sell");
  const buy = txs.find((t) => t.side === "buy");
  const fee = txs.find((t) => t.side === "fee");
  if (!sell || !buy || !fee) throw new Error("swap should yield sell+buy+fee");
  if (sell.asset !== "ETH" || buy.asset !== "USDC") {
    throw new Error("swap assets mismatch");
  }
  if (sell.jpyValue !== buy.jpyValue) {
    throw new Error("swap legs must share JPY");
  }
  if (sell.jpyValue !== 400_000) {
    throw new Error(`expected shared JPY 400000 got ${sell.jpyValue}`);
  }
  if (sell.priceSource !== "derived_trade" || buy.counterAsset !== "ETH") {
    throw new Error("swap should mark derived_trade + counterAsset");
  }
}

// Wrap: ETH ↔ WETH
{
  const txs = classifyWalletLegs([
    leg({
      id: "e",
      asset: "ETH",
      direction: "out",
      quantity: 2,
      jpyValue: 800_000,
      from: WALLET,
      to: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    }),
    leg({
      id: "w",
      asset: "WETH",
      direction: "in",
      quantity: 2,
      jpyValue: 800_000,
      from: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      to: WALLET,
    }),
  ]);
  if (txs.length !== 1 || txs[0].side !== "wrap") {
    throw new Error(`expected single wrap, got ${txs.map((t) => t.side)}`);
  }
  if (txs[0].counterAsset !== "WETH" || txs[0].jpyValue !== 0) {
    throw new Error("wrap metadata mismatch");
  }
}

// Self-transfer to another linked wallet
{
  const txs = classifyWalletLegs(
    [
      leg({
        id: "x",
        asset: "ETH",
        direction: "out",
        quantity: 0.5,
        jpyValue: 200_000,
        from: WALLET,
        to: OTHER,
      }),
    ],
    { linkedAddresses: [OTHER] },
  );
  if (txs.length !== 1 || txs[0].side !== "transfer_out") {
    throw new Error(`expected transfer_out, got ${txs[0]?.side}`);
  }
  if (txs[0].jpyValue !== 0) {
    throw new Error("self-transfer should zero JPY");
  }
}

// Borrow: inbound from Aave pool only
{
  const txs = classifyWalletLegs([
    leg({
      id: "b",
      asset: "USDC",
      direction: "in",
      quantity: 1000,
      jpyValue: 150_000,
      from: AAVE_V3,
      to: WALLET,
    }),
  ]);
  if (txs[0]?.side !== "borrow") {
    throw new Error(`expected borrow, got ${txs[0]?.side}`);
  }
}

// Repay: outbound to Aave pool only
{
  const txs = classifyWalletLegs([
    leg({
      id: "r",
      asset: "USDC",
      direction: "out",
      quantity: 1000,
      jpyValue: 150_000,
      from: WALLET,
      to: AAVE_V3,
    }),
  ]);
  if (txs[0]?.side !== "repay") {
    throw new Error(`expected repay, got ${txs[0]?.side}`);
  }
}

// Supply-like: out to pool + unknown aToken in → transfer/wrap, not swap
{
  const txs = classifyWalletLegs([
    leg({
      id: "s",
      asset: "USDC",
      direction: "out",
      quantity: 500,
      jpyValue: 75_000,
      from: WALLET,
      to: AAVE_V3,
      knownAsset: true,
    }),
    leg({
      id: "a",
      asset: "AUSDC",
      direction: "in",
      quantity: 500,
      jpyValue: 0,
      from: AAVE_V3,
      to: WALLET,
      knownAsset: false,
    }),
  ]);
  if (txs.some((t) => t.side === "sell" || t.side === "buy")) {
    throw new Error("lending supply must not classify as swap buy/sell");
  }
  const wrapOrTransfer = txs.some(
    (t) =>
      t.side === "wrap" ||
      (t.side === "transfer_out" && t.asset === "USDC"),
  );
  if (!wrapOrTransfer) {
    throw new Error("expected wrap or USDC transfer_out for supply-like hash");
  }
}

// LEND↔ALEND without known pool address (Aave V1-style) must not be a swap
{
  const hash = "0xlendalend";
  const txs = classifyWalletLegs([
    leg({
      id: "lend_out",
      asset: "LEND",
      direction: "out",
      quantity: 1000,
      jpyValue: 50_000,
      txHash: hash,
      from: WALLET,
      to: DEX,
      knownAsset: true,
    }),
    leg({
      id: "alend_in",
      asset: "ALEND",
      direction: "in",
      quantity: 1000,
      jpyValue: 50_000,
      txHash: hash,
      from: DEX,
      to: WALLET,
      knownAsset: true,
    }),
  ]);
  if (txs.some((t) => t.side === "sell" || t.side === "buy")) {
    throw new Error("LEND↔ALEND must not classify as derived_trade swap");
  }
  if (!txs.some((t) => t.side === "wrap" && t.asset === "LEND")) {
    throw new Error(`expected LEND wrap for aToken supply, got ${txs.map((t) => t.side)}`);
  }
}

// ETH↔AETH aToken pair
{
  const hash = "0xaeth";
  const txs = classifyWalletLegs([
    leg({
      id: "eth_out",
      asset: "ETH",
      direction: "out",
      quantity: 2,
      jpyValue: 400_000,
      txHash: hash,
      from: WALLET,
      to: DEX,
    }),
    leg({
      id: "aeth_in",
      asset: "AETH",
      direction: "in",
      quantity: 2,
      jpyValue: 400_000,
      txHash: hash,
      from: DEX,
      to: WALLET,
    }),
  ]);
  if (txs.some((t) => t.side === "sell" || t.side === "buy")) {
    throw new Error("ETH↔AETH must not classify as swap");
  }
  if (txs[0]?.side !== "wrap") {
    throw new Error(`expected wrap for ETH↔AETH, got ${txs[0]?.side}`);
  }
}

// Income: inbound from known airdrop distributor
{
  const txs = classifyWalletLegs([
    leg({
      id: "air",
      asset: "UNI",
      direction: "in",
      quantity: 400,
      jpyValue: 800_000,
      from: UNI_AIRDROP,
      to: WALLET,
    }),
  ]);
  if (txs[0]?.side !== "income") {
    throw new Error(`expected income, got ${txs[0]?.side}`);
  }
}

// Spam: unknown unpaid inbound skipped
{
  const txs = classifyWalletLegs([
    leg({
      id: "spam",
      asset: "SCAM",
      direction: "in",
      quantity: 1e18,
      jpyValue: 0,
      knownAsset: false,
      from: "0x4444444444444444444444444444444444444444",
      to: WALLET,
    }),
  ]);
  if (txs.length !== 0) throw new Error("spam inbound should be skipped");
}

// Unknown one-sided outbound → transfer_out (not sell)
{
  const txs = classifyWalletLegs([
    leg({
      id: "out_unk",
      asset: "ETH",
      direction: "out",
      quantity: 0.1,
      jpyValue: 0,
      priceSource: "unknown",
      knownAsset: true,
      from: WALLET,
      to: "0x5555555555555555555555555555555555555555",
    }),
  ]);
  if (txs[0]?.side !== "transfer_out") {
    throw new Error(`expected transfer_out, got ${txs[0]?.side}`);
  }
}

// Low-confidence inbound (unknown price) → transfer_in (not buy)
{
  const txs = classifyWalletLegs([
    leg({
      id: "in_unk",
      asset: "ETH",
      direction: "in",
      quantity: 0.2,
      jpyValue: 0,
      priceSource: "unknown",
      knownAsset: true,
      from: "0x5555555555555555555555555555555555555555",
      to: WALLET,
    }),
  ]);
  if (txs[0]?.side !== "transfer_in") {
    throw new Error(`expected transfer_in, got ${txs[0]?.side}`);
  }
}

// Multi-hop netting: intermediate USDC cancels → ETH out + WBTC in swap
{
  const hash = "0xmultihop";
  const txs = classifyWalletLegs([
    leg({
      id: "1",
      asset: "ETH",
      direction: "out",
      quantity: 1,
      jpyValue: 500_000,
      txHash: hash,
      from: WALLET,
      to: DEX,
    }),
    leg({
      id: "2",
      asset: "USDC",
      direction: "in",
      quantity: 3000,
      jpyValue: 450_000,
      txHash: hash,
      from: DEX,
      to: WALLET,
    }),
    leg({
      id: "3",
      asset: "USDC",
      direction: "out",
      quantity: 3000,
      jpyValue: 450_000,
      txHash: hash,
      from: WALLET,
      to: DEX,
    }),
    leg({
      id: "4",
      asset: "WBTC",
      direction: "in",
      quantity: 0.01,
      jpyValue: 480_000,
      txHash: hash,
      from: DEX,
      to: WALLET,
    }),
  ]);
  const sell = txs.find((t) => t.side === "sell");
  const buy = txs.find((t) => t.side === "buy");
  if (!sell || !buy || sell.asset !== "ETH" || buy.asset !== "WBTC") {
    throw new Error(
      `multihop expected ETH→WBTC swap, got ${txs.map((t) => `${t.side}:${t.asset}`)}`,
    );
  }
  if (sell.jpyValue !== buy.jpyValue) {
    throw new Error("multihop swap must share JPY");
  }
}

console.log("classify-wallet checks ok");
