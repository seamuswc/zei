import { NextResponse } from "next/server";
import { getCurrentUser, isPro } from "@/lib/auth";
import { saveLedger } from "@/lib/ledger-store";
import type { CryptoTx } from "@/lib/tax/types";
import { apiJsonError } from "@/lib/i18n/api";

export const runtime = "nodejs";

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiJsonError(req, "login_required", 401);
  }
  if (!user.emailVerified) {
    return apiJsonError(req, "verify_before_save", 403);
  }
  if (!isPro(user)) {
    return apiJsonError(req, "pro_required", 402);
  }

  const body = (await req.json()) as {
    txs?: CryptoTx[];
    otherIncomeJpy?: number;
    incomeProvided?: boolean;
    year?: number;
  };

  saveLedger(user.id, {
    txs: body.txs ?? [],
    otherIncomeJpy: body.otherIncomeJpy ?? 0,
    incomeProvided: !!body.incomeProvided,
    year: body.year ?? 2025,
  });

  return NextResponse.json({ ok: true });
}
