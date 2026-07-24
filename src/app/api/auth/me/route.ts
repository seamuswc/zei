import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listTaxYears, loadLedger } from "@/lib/ledger-store";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  const ledger = loadLedger(user.id);
  const taxYears = listTaxYears(user.id);
  return NextResponse.json({ user, ledger, taxYears });
}
