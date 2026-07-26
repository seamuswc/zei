import { isEnsName, isEthHexAddress, normalizeWalletInput } from "./ens-format";
import { keccak256, namehash } from "./ens";

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(
  hex(keccak256(new Uint8Array())) ===
    "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
  "keccak256 empty",
);

assert(
  namehash("vitalik.eth") ===
    "0xee6c4522aab0003e8d14cd40a6af439055fd2577951148c14b6cea9a53475835",
  "namehash vitalik.eth",
);

assert(isEnsName("vitalik.eth"), "vitalik.eth valid");
assert(isEnsName("Vitalik.ETH"), "case-insensitive shape via normalize");
assert(isEnsName(normalizeWalletInput(" Vitalik.ETH ")), "normalize + ens");
assert(!isEnsName("vitalik"), "no tld");
assert(!isEnsName("-bad.eth"), "leading hyphen");
assert(!isEnsName("foo.bar"), "non-.eth");
assert(isEthHexAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"), "0x ok");
assert(!isEthHexAddress("0x123"), "short 0x");

console.log("ens.test.ts: ok");
