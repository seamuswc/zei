import { NextResponse } from "next/server";
import { consumeEmailToken, markEmailVerified } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/?verify=missing", req.url));
  }
  try {
    const userId = consumeEmailToken(token, "verify");
    markEmailVerified(userId);
    return NextResponse.redirect(new URL("/?verify=ok", req.url));
  } catch {
    return NextResponse.redirect(new URL("/?verify=bad", req.url));
  }
}
