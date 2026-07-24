import { NextResponse } from "next/server";
import { sendResetEmail } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rl = rateLimit(`forgot:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Retry in ${rl.retryAfterSec}s.` },
      { status: 429 },
    );
  }
  try {
    const body = (await req.json()) as { email?: string };
    await sendResetEmail(body.email || "");
    return NextResponse.json({
      ok: true,
      message: "If that email exists, a reset link was sent.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 400 },
    );
  }
}
