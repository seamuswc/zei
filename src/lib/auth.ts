import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import {
  appBaseUrl,
  resetEmailContent,
  sendEmail,
  verifyEmailContent,
} from "@/lib/mail";

const COOKIE = "zei_session";
const secret = () =>
  new TextEncoder().encode(
    process.env.AUTH_SECRET || "zei-dev-secret-change-me-in-production",
  );

function uid(): string {
  return randomBytes(16).toString("hex");
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionUser = {
  id: string;
  email: string;
  plan: "free" | "pro";
  planExpiresAt: string | null;
  emailVerified: boolean;
};

export function createEmailToken(
  userId: string,
  purpose: "verify" | "reset",
  hours = 24,
): string {
  const db = getDb();
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + hours * 3600_000).toISOString();
  db.prepare(
    `DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?`,
  ).run(userId, purpose);
  db.prepare(
    `INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(hashToken(token), userId, purpose, expires, now.toISOString());
  return token;
}

export async function sendVerifyEmail(userId: string, email: string) {
  const token = createEmailToken(userId, "verify", 48);
  const link = `${appBaseUrl()}/api/auth/verify?token=${token}`;
  const mail = verifyEmailContent(link);
  await sendEmail({
    to: email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  return link;
}

export async function sendResetEmail(emailRaw: string) {
  const db = getDb();
  const email = emailRaw.trim().toLowerCase();
  const row = db
    .prepare(`SELECT id, email FROM users WHERE email = ?`)
    .get(email) as { id: string; email: string } | undefined;
  // Always act succeeded to avoid email enumeration
  if (!row) return;
  const token = createEmailToken(row.id, "reset", 2);
  const link = `${appBaseUrl()}/reset?token=${token}`;
  const mail = resetEmailContent(link);
  await sendEmail({
    to: row.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

export function consumeEmailToken(
  token: string,
  purpose: "verify" | "reset",
): string {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT user_id, expires_at FROM email_tokens WHERE token_hash = ? AND purpose = ?`,
    )
    .get(hashToken(token), purpose) as
    | { user_id: string; expires_at: string }
    | undefined;
  if (!row) throw new Error("api:invalid_link");
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare(`DELETE FROM email_tokens WHERE token_hash = ?`).run(
      hashToken(token),
    );
    throw new Error("api:invalid_link");
  }
  db.prepare(`DELETE FROM email_tokens WHERE token_hash = ?`).run(
    hashToken(token),
  );
  return row.user_id;
}

export function markEmailVerified(userId: string) {
  const db = getDb();
  db.prepare(
    `UPDATE users SET email_verified_at = ? WHERE id = ?`,
  ).run(new Date().toISOString(), userId);
}

export function setPassword(userId: string, password: string) {
  if (password.length < 8) throw new Error("api:password_short");
  const db = getDb();
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
    hashPassword(password),
    userId,
  );
}

export async function registerUser(
  email: string,
  password: string,
): Promise<{ user: SessionUser; verifyLinkDev?: string }> {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@") || password.length < 8) {
    throw new Error("api:email_password_required");
  }
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(normalized);
  if (existing) throw new Error("api:email_taken");

  const id = uid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, plan, plan_expires_at, email_verified_at, created_at)
     VALUES (?, ?, ?, 'free', NULL, NULL, ?)`,
  ).run(id, normalized, hashPassword(password), now);

  db.prepare(
    `INSERT INTO ledgers (user_id, txs_json, other_income_jpy, income_provided, year, updated_at)
     VALUES (?, '[]', 0, 0, 2025, ?)`,
  ).run(id, now);

  let verifyLinkDev: string | undefined;
  try {
    const link = await sendVerifyEmail(id, normalized);
    if (!process.env.RESEND_API_KEY) verifyLinkDev = link;
  } catch (e) {
    console.error("verify email failed", e);
  }

  return {
    user: {
      id,
      email: normalized,
      plan: "free",
      planExpiresAt: null,
      emailVerified: false,
    },
    verifyLinkDev,
  };
}

export function loginUser(email: string, password: string): SessionUser {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, email, password_hash, plan, plan_expires_at, email_verified_at FROM users WHERE email = ?`,
    )
    .get(email.trim().toLowerCase()) as
    | {
        id: string;
        email: string;
        password_hash: string;
        plan: string;
        plan_expires_at: string | null;
        email_verified_at: string | null;
      }
    | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new Error("api:invalid_credentials");
  }
  if (!row.email_verified_at && process.env.REQUIRE_EMAIL_VERIFY !== "0") {
    throw new Error("api:email_unverified");
  }
  return {
    id: row.id,
    email: row.email,
    plan: row.plan === "pro" ? "pro" : "free",
    planExpiresAt: row.plan_expires_at,
    emailVerified: !!row.email_verified_at,
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  const db = getDb();
  const expires = new Date(Date.now() + 30 * 864e5).toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
  ).run(createHash("sha256").update(token).digest("hex"), userId, expires);

  return token;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86400,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = String(payload.uid || "");
    if (!userId) return null;
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, email, plan, plan_expires_at, email_verified_at FROM users WHERE id = ?`,
      )
      .get(userId) as
      | {
          id: string;
          email: string;
          plan: string;
          plan_expires_at: string | null;
          email_verified_at: string | null;
        }
      | undefined;
    if (!row) return null;

    let plan: "free" | "pro" = row.plan === "pro" ? "pro" : "free";
    if (plan === "pro" && row.plan_expires_at) {
      if (new Date(row.plan_expires_at).getTime() < Date.now()) {
        plan = "free";
        db.prepare(`UPDATE users SET plan = 'free' WHERE id = ?`).run(row.id);
      }
    }

    return {
      id: row.id,
      email: row.email,
      plan,
      planExpiresAt: row.plan_expires_at,
      emailVerified: !!row.email_verified_at,
    };
  } catch {
    return null;
  }
}

export function isPro(user: SessionUser | null): boolean {
  return user?.plan === "pro";
}

export function unlockPro(userId: string, days = 365) {
  const db = getDb();
  const expires = new Date(Date.now() + days * 864e5).toISOString();
  db.prepare(
    `UPDATE users SET plan = 'pro', plan_expires_at = ? WHERE id = ?`,
  ).run(expires, userId);
}
