import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { markPaymentFinished } from "@/lib/payments";

export const runtime = "nodejs";

/** NOWPayments IPN webhook */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (secret) {
    const sig = req.headers.get("x-nowpayments-sig") || "";
    const calc = createHmac("sha512", secret).update(raw).digest("hex");
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(calc);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return NextResponse.json({ error: "bad sig" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "bad sig" }, { status: 401 });
    }
  }

  const data = JSON.parse(raw) as {
    order_id?: string;
    payment_status?: string;
  };
  if (data.order_id && data.payment_status) {
    markPaymentFinished({
      orderId: data.order_id,
      status: data.payment_status,
      raw: data,
    });
  }
  return NextResponse.json({ ok: true });
}
