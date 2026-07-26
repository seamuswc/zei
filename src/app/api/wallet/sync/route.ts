import { NextResponse } from "next/server";
import { fetchLiveWalletTxs } from "@/lib/import/wallet-live";
import { EnsResolveError } from "@/lib/ens";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, pruneRateLimits } from "@/lib/rate-limit";
import {
  apiJsonError,
  apiT,
  localeFromRequest,
  type ApiMsgKey,
} from "@/lib/i18n/api";

export const runtime = "nodejs";

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function ensErrorKey(code: EnsResolveError["code"]): ApiMsgKey {
  switch (code) {
    case "invalid_ens":
      return "wallet_ens_invalid";
    case "not_found":
      return "wallet_ens_not_found";
    case "resolve_failed":
    default:
      return "wallet_ens_resolve_failed";
  }
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const user = await getCurrentUser();
  // Logged-in: moderate; guests: heavy IP throttle (sync hits Etherscan).
  const rl = user
    ? rateLimit(`wallet-sync:user:${user.id}`, 30, 60_000)
    : rateLimit(`wallet-sync:ip:${ip}`, 4, 60_000);
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
      address?: string;
      linkedAddresses?: string[];
    };
    const address = body.address?.trim();
    if (!address) {
      return apiJsonError(req, "wallet_address_required", 400);
    }

    const linkedAddresses = Array.isArray(body.linkedAddresses)
      ? body.linkedAddresses.filter((a): a is string => typeof a === "string")
      : [];

    // Always use server ETHERSCAN_API_KEY — never ask the client for one.
    // ENS names (e.g. vitalik.eth) are resolved server-side before sync.
    const result = await fetchLiveWalletTxs({ address, linkedAddresses });

    return NextResponse.json({
      address: result.address,
      ens: result.ens ?? null,
      chain: result.chain,
      chainLabel: result.chainLabel,
      truncated: result.truncated,
      count: result.txs.length,
      txs: result.txs,
    });
  } catch (err) {
    if (err instanceof EnsResolveError) {
      return apiJsonError(req, ensErrorKey(err.code), 400);
    }
    const locale = localeFromRequest(req);
    const message = err instanceof Error ? err.message : "Wallet sync failed";
    // Prefer localized invalid-address when the English fallback is thrown
    if (/valid Ethereum/i.test(message)) {
      return NextResponse.json(
        { error: apiT(locale, "wallet_address_invalid") },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
