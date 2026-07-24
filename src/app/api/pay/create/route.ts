import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createCryptoInvoice } from "@/lib/payments";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }
  try {
    const invoice = await createCryptoInvoice({
      userId: user.id,
      email: user.email,
    });
    return NextResponse.json(invoice);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Payment failed" },
      { status: 500 },
    );
  }
}
