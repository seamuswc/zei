import { NextResponse } from "next/server";
import { getCurrentUser, isPro } from "@/lib/auth";
import { saveLedger } from "@/lib/ledger-store";
import type { CryptoTx } from "@/lib/tax/types";

export const runtime = "nodejs";

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }
  if (!user.emailVerified) {
    return NextResponse.json(
      { error: "Verify your email before saving." },
      { status: 403 },
    );
  }
  if (!isPro(user)) {
    return NextResponse.json(
      { error: "Pro plan required to save cloud ledger. Pay with crypto to unlock." },
      { status: 402 },
    );
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
