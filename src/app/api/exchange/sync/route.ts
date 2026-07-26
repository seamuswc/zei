import { NextResponse } from "next/server";
import { fetchExchangeLive } from "@/lib/import/exchange-live";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, pruneRateLimits } from "@/lib/rate-limit";
import { apiJsonError, apiT, localeFromRequest } from "@/lib/i18n/api";

export const runtime = "nodejs";

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const user = await getCurrentUser();
  // Guests get a tight IP cap — body carries API secrets for a one-shot sync.
  const rl = user
    ? rateLimit(`exchange-sync:user:${user.id}`, 20, 60_000)
    : rateLimit(`exchange-sync:ip:${ip}`, 3, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: apiT(localeFromRequest(req), "too_many", {
          sec: rl.retryAfterSec ?? 60,
        }),
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec ?? 60) },
      },
    );
  }
  if (Math.random() < 0.05) pruneRateLimits();

  try {
    const body = (await req.json()) as {
      exchange?: string;
      apiKey?: string;
      apiSecret?: string;
      passphrase?: string;
    };

    const exchange = body.exchange?.trim();
    const apiKey = body.apiKey?.trim();
    const apiSecret = body.apiSecret?.trim();
    const passphrase = body.passphrase?.trim();

    if (!exchange || !apiKey || !apiSecret) {
      return apiJsonError(req, "exchange_creds_required", 400);
    }

    // Never log or persist secrets — one-shot sync only
    const { txs, warning } = await fetchExchangeLive(
      exchange,
      apiKey,
      apiSecret,
      passphrase,
    );

    return NextResponse.json({
      exchange,
      count: txs.length,
      txs,
      warning,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Exchange sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
