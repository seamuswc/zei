import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createCryptoInvoice } from "@/lib/payments";
import { apiJsonError, localizeThrown } from "@/lib/i18n/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiJsonError(req, "login_required", 401);
  }
  try {
    const invoice = await createCryptoInvoice({
      userId: user.id,
      email: user.email,
    });
    return NextResponse.json(invoice);
  } catch (e) {
    return NextResponse.json(
      { error: localizeThrown(req, e, "payment_failed") },
      { status: 500 },
    );
  }
}
