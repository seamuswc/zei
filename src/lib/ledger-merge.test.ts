import type { CryptoTx } from "./tax/types";
import { mergeLedgerById } from "./ledger-merge";

function tx(id: string, note?: string): CryptoTx {
  return {
    id,
    date: "2025-01-01",
    asset: "ETH",
    side: "buy",
    quantity: 1,
    jpyValue: 100,
    source: "wallet",
    note,
  };
}

{
  const local = [tx("a", "local-a"), tx("b", "local-b")];
  const server = [tx("b", "server-b"), tx("c", "server-c")];
  const merged = mergeLedgerById(local, server);
  const byId = Object.fromEntries(merged.map((t) => [t.id, t.note]));
  if (byId.a !== "local-a") throw new Error("local-only should keep");
  if (byId.c !== "server-c") throw new Error("server-only should add");
  if (byId.b !== "local-b") {
    throw new Error("conflict without updatedAt should keep local");
  }
}

{
  type Row = CryptoTx & { updatedAt?: string };
  const local: Row[] = [{ ...tx("x", "old"), updatedAt: "2025-01-01T00:00:00Z" }];
  const server: Row[] = [{ ...tx("x", "new"), updatedAt: "2025-06-01T00:00:00Z" }];
  const merged = mergeLedgerById(local, server);
  if (merged[0]?.note !== "new") {
    throw new Error("newer server updatedAt should win");
  }
}

console.log("ledger-merge checks ok");
