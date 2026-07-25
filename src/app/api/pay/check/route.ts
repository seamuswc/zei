import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { confirmDevPayment, verifyUsdcPayment } from "@/lib/payments";
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
      devConfirm?: boolean;
    };
    if (!body.paymentId) {
      return NextResponse.json({ error: "paymentId required" }, { status: 400 });
    }

    if (body.devConfirm) {
      try {
        const result = confirmDevPayment({
          paymentId: body.paymentId,
          userId: user.id,
        });
        return NextResponse.json(result);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Dev confirm failed" },
          { status: 400 },
        );
      }
    }

    const result = await verifyUsdcPayment({
      paymentId: body.paymentId,
      userId: user.id,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: localizeThrown(req, e, "payment_failed") },
      { status: 500 },
    );
  }
}
