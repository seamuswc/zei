import { NextResponse } from "next/server";
import { consumeEmailToken, setPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rl = rateLimit(`reset:${ip}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Retry in ${rl.retryAfterSec}s.` },
      { status: 429 },
    );
  }
  try {
    const body = (await req.json()) as { token?: string; password?: string };
    const userId = consumeEmailToken(body.token || "", "reset");
    setPassword(userId, body.password || "");
    return NextResponse.json({ ok: true, message: "Password updated. Log in." });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Reset failed" },
      { status: 400 },
    );
  }
}
