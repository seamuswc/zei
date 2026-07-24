import { NextResponse } from "next/server";
import { createSession, loginUser, setSessionCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rl = rateLimit(`login:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Retry in ${rl.retryAfterSec}s.` },
      { status: 429 },
    );
  }
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const user = loginUser(body.email || "", body.password || "");
    const token = await createSession(user.id);
    await setSessionCookie(token);
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Login failed" },
      { status: 400 },
    );
  }
}
