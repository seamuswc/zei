import { NextResponse } from "next/server";
import {
  createSession,
  registerUser,
  setSessionCookie,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rl = rateLimit(`register:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Retry in ${rl.retryAfterSec}s.` },
      { status: 429 },
    );
  }
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const { user, verifyLinkDev } = await registerUser(
      body.email || "",
      body.password || "",
    );
    // Do not auto-login until verified
    return NextResponse.json({
      user,
      needsVerify: true,
      message:
        "Account created. Verify your email before logging in. In local dev, check data/mail/ or the verifyLinkDev field.",
      verifyLinkDev,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Register failed" },
      { status: 400 },
    );
  }
}
