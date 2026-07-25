import { NextResponse } from "next/server";
import { createSession, loginUser, setSessionCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { apiJsonError, localizeThrown } from "@/lib/i18n/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rl = rateLimit(`login:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return apiJsonError(req, "too_many", 429, { sec: rl.retryAfterSec ?? 60 });
  }
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const user = loginUser(body.email || "", body.password || "");
    const token = await createSession(user.id);
    await setSessionCookie(token);
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json(
      { error: localizeThrown(req, e, "login_failed") },
      { status: 400 },
    );
  }
}
