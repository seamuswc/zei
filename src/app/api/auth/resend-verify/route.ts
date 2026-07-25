import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendVerifyEmail } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  apiJsonError,
  apiT,
  localeFromRequest,
  localizeThrown,
} from "@/lib/i18n/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rl = rateLimit(`resend:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return apiJsonError(req, "too_many", 429, { sec: rl.retryAfterSec ?? 60 });
  }
  try {
    const body = (await req.json()) as { email?: string };
    const email = (body.email || "").trim().toLowerCase();
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, email, email_verified_at FROM users WHERE email = ?`,
      )
      .get(email) as
      | { id: string; email: string; email_verified_at: string | null }
      | undefined;

    const locale = localeFromRequest(req);
    if (row && !row.email_verified_at) {
      const link = await sendVerifyEmail(row.id, row.email);
      return NextResponse.json({
        ok: true,
        message: apiT(locale, "verify_sent"),
        verifyLinkDev: process.env.RESEND_API_KEY ? undefined : link,
      });
    }
    return NextResponse.json({
      ok: true,
      message: apiT(locale, "verify_sent_if"),
    });
  } catch (e) {
    return NextResponse.json(
      { error: localizeThrown(req, e, "resend_failed") },
      { status: 400 },
    );
  }
}
