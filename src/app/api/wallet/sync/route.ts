import { NextResponse } from "next/server";
import { fetchLiveWalletTxs } from "@/lib/import/wallet-live";
import { EnsResolveError } from "@/lib/ens";
import {
  apiJsonError,
  apiT,
  localeFromRequest,
  type ApiMsgKey,
} from "@/lib/i18n/api";

export const runtime = "nodejs";

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
