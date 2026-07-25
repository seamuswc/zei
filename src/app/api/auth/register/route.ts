import { NextResponse } from "next/server";
import {
  createSession,
  registerUser,
  setSessionCookie,
} from "@/lib/auth";
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
  const rl = rateLimit(`register:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return apiJsonError(req, "too_many", 429, { sec: rl.retryAfterSec ?? 60 });
  }
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const { user, verifyLinkDev } = await registerUser(
      body.email || "",
      body.password || "",
    );
    const locale = localeFromRequest(req);
    return NextResponse.json({
      user,
      needsVerify: true,
      message: apiT(locale, "account_created"),
      verifyLinkDev,
    });
  } catch (e) {
    return NextResponse.json(
      { error: localizeThrown(req, e, "register_failed") },
      { status: 400 },
    );
  }
}
