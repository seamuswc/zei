import { NextResponse } from "next/server";
import { getCurrentUser, isPro } from "@/lib/auth";
import { isFilingYearLocked } from "@/lib/billing";
import {
  buildAccountantPack,
  zipStore,
} from "@/lib/export/accountant";
import { summarizeTaxYear } from "@/lib/tax/engine";
import { exportBlockedByMissingPrices } from "@/lib/tax/price-quality";
import type { CryptoTx } from "@/lib/tax/types";
import { rateLimit } from "@/lib/rate-limit";
import { apiJsonError } from "@/lib/i18n/api";

export const runtime = "nodejs";

/**
 * Server-gated accountant ZIP.
 * Locked filing years require Pro. Missing/unknown JPY on sell|income blocks export.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiJsonError(req, "login_required", 401);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`export:${user.id}:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many export requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } },
    );
  }

  try {
    const body = (await req.json()) as {
      year?: number;
      txs?: CryptoTx[];
      otherIncomeJpy?: number;
      matchedTransfers?: number;
    };
    const year = Number(body.year);
    if (!Number.isFinite(year) || year < 2009 || year > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    if (!Array.isArray(body.txs)) {
      return NextResponse.json({ error: "txs required" }, { status: 400 });
    }

    const pro = isPro(user);
    if (isFilingYearLocked(year, pro)) {
      return NextResponse.json(
        {
          error: "Pro required for this filing year export",
          code: "pro_required",
        },
        { status: 403 },
      );
    }

    if (exportBlockedByMissingPrices(body.txs, year)) {
      return NextResponse.json(
        {
          error:
            "Export blocked: some sell/income rows have unknown or ¥0 prices. Fix them in Review.",
          code: "missing_prices",
        },
        { status: 400 },
      );
    }

    const summary = summarizeTaxYear(body.txs, year);
    const pack = buildAccountantPack({
      year,
      txs: body.txs,
      summary,
      otherIncomeJpy: Math.max(0, Number(body.otherIncomeJpy) || 0),
      matchedTransfers: body.matchedTransfers,
    });
    const bytes = zipStore(pack.files);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${pack.filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
