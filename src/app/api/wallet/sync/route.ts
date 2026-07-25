import { NextResponse } from "next/server";
import { fetchLiveWalletTxs } from "@/lib/import/wallet-live";
import { apiJsonError } from "@/lib/i18n/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      address?: string;
      etherscanApiKey?: string;
    };
    const address = body.address?.trim();
    if (!address) {
      return apiJsonError(req, "wallet_address_required", 400);
    }

    const result = await fetchLiveWalletTxs({
      address,
      etherscanApiKey: body.etherscanApiKey,
    });

    return NextResponse.json({
      address: result.address,
      chain: result.chain,
      count: result.txs.length,
      txs: result.txs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Wallet sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
