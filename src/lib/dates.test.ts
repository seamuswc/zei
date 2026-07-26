import { tokyoDateFromTs, tokyoDateFromUnknown } from "./dates";

// 2024-01-01 00:30 UTC → still Dec 31 in Tokyo (UTC+9)
{
  const d = tokyoDateFromTs(Date.UTC(2024, 0, 1, 0, 30, 0) / 1000);
  if (d !== "2024-01-01") {
    // 00:30 UTC = 09:30 JST on Jan 1
    throw new Error(`expected 2024-01-01 got ${d}`);
  }
}

// Late UTC evening → next calendar day in Tokyo
{
  const d = tokyoDateFromTs(Date.UTC(2024, 5, 15, 16, 0, 0) / 1000);
  // 16:00 UTC = 01:00 JST next day
  if (d !== "2024-06-16") {
    throw new Error(`expected 2024-06-16 got ${d}`);
  }
}

// Bare date passthrough
{
  const d = tokyoDateFromUnknown("2023-12-31");
  if (d !== "2023-12-31") throw new Error(`passthrough failed: ${d}`);
}

console.log("dates checks ok");
