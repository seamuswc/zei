import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { completeDevPayment } from "@/lib/payments";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/?error=login", req.url));
  }
  const paymentId = new URL(req.url).searchParams.get("paymentId");
  if (!paymentId) {
    return NextResponse.json({ error: "missing paymentId" }, { status: 400 });
  }
  try {
    completeDevPayment(paymentId, user.id);
    return NextResponse.redirect(new URL("/?paid=1", req.url));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "dev pay failed" },
      { status: 400 },
    );
  }
}
