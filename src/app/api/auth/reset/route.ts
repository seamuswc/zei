import { NextResponse } from "next/server";
import { consumeEmailToken, setPassword } from "@/lib/auth";
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
  const rl = rateLimit(`reset:${ip}`, 8, 60_000);
  if (!rl.ok) {
    return apiJsonError(req, "too_many", 429, { sec: rl.retryAfterSec ?? 60 });
  }
  try {
    const body = (await req.json()) as { token?: string; password?: string };
    const userId = consumeEmailToken(body.token || "", "reset");
    setPassword(userId, body.password || "");
    return NextResponse.json({
      ok: true,
      message: apiT(localeFromRequest(req), "password_updated"),
    });
  } catch (e) {
    return NextResponse.json(
      { error: localizeThrown(req, e, "reset_failed") },
      { status: 400 },
    );
  }
}
