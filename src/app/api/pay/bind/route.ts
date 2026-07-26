import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { bindPaymentFromAddress } from "@/lib/payments";
import { apiJsonError, localizeThrown } from "@/lib/i18n/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiJsonError(req, "login_required", 401);
  }
  try {
    const body = (await req.json()) as {
      paymentId?: string;
      fromAddress?: string;
    };
    if (!body.paymentId || !body.fromAddress) {
      return NextResponse.json(
        { error: "paymentId and fromAddress required" },
        { status: 400 },
      );
    }
    const result = bindPaymentFromAddress({
      paymentId: body.paymentId,
      userId: user.id,
      fromAddress: body.fromAddress,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: localizeThrown(req, e, "payment_failed") },
      { status: 400 },
    );
  }
}
