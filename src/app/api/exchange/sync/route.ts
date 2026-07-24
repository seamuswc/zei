import { NextResponse } from "next/server";
import { fetchExchangeLive } from "@/lib/import/exchange-live";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      exchange?: string;
      apiKey?: string;
      apiSecret?: string;
    };

    const exchange = body.exchange?.trim();
    const apiKey = body.apiKey?.trim();
    const apiSecret = body.apiSecret?.trim();

    if (!exchange || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "exchange, apiKey, and apiSecret are required." },
        { status: 400 },
      );
    }

    // Never log secrets
    const txs = await fetchExchangeLive(exchange, apiKey, apiSecret);

    return NextResponse.json({
      exchange,
      count: txs.length,
      txs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Exchange sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
