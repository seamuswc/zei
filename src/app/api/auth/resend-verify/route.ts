import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendVerifyEmail } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rl = rateLimit(`resend:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Retry in ${rl.retryAfterSec}s.` },
      { status: 429 },
    );
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

    if (row && !row.email_verified_at) {
      const link = await sendVerifyEmail(row.id, row.email);
      return NextResponse.json({
        ok: true,
        message: "Verification email sent.",
        verifyLinkDev: process.env.RESEND_API_KEY ? undefined : link,
      });
    }
    return NextResponse.json({
      ok: true,
      message: "If that account needs verification, a link was sent.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Resend failed" },
      { status: 400 },
    );
  }
}
