import { NextResponse } from "next/server";
import { consumeEmailToken, markEmailVerified } from "@/lib/auth";
import { appBaseUrl } from "@/lib/mail";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const base = appBaseUrl();
  if (!token) {
    return NextResponse.redirect(new URL("/?verify=missing", base));
  }
  try {
    const userId = consumeEmailToken(token, "verify");
    markEmailVerified(userId);
    return NextResponse.redirect(new URL("/?verify=ok", base));
  } catch {
    return NextResponse.redirect(new URL("/?verify=bad", base));
  }
}
