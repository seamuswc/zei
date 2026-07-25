import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createUsdcInvoice } from "@/lib/payments";
import { apiJsonError, localizeThrown } from "@/lib/i18n/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiJsonError(req, "login_required", 401);
  }
  if (!user.emailVerified && process.env.REQUIRE_EMAIL_VERIFY !== "0") {
    return apiJsonError(req, "verify_before_save", 403);
  }
  try {
    const invoice = await createUsdcInvoice({
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
