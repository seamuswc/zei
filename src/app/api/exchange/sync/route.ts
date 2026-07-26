import { NextResponse } from "next/server";
import { fetchExchangeLive } from "@/lib/import/exchange-live";
import { apiJsonError } from "@/lib/i18n/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
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
