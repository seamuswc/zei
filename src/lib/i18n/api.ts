import { NextResponse } from "next/server";
import { formatMessage, type Locale } from "@/lib/i18n/messages";

export type ApiMsgKey = keyof (typeof apiMessages)["ja"];

export const apiMessages = {
  ja: {
    too_many: "試行回数の上限です。{sec}秒後に再試行してください。",
    register_failed: "登録に失敗しました。",
    login_failed: "ログインに失敗しました。",
    request_failed: "リクエストに失敗しました。",
    resend_failed: "再送に失敗しました。",
    reset_failed: "再設定に失敗しました。",
    account_created:
      "アカウントを作成しました。確認メールを送信済みです。受信箱（と迷惑メール）のリンクを開いてからログインしてください。届かない場合は「確認メールを再送」を使ってください。",
    reset_sent: "そのメールが登録済みなら、リセットリンクを送信しました。",
    verify_sent: "確認メールを送信しました。",
    verify_sent_if: "確認が必要なアカウントなら、リンクを送信しました。",
    password_updated: "パスワードを更新しました。ログインしてください。",
    login_required: "ログインが必要です。",
    verify_before_save: "保存前にメール確認が必要です。",
    pro_required:
      "申告年度の合計・出力にはProプランが必要です。USDCで決済して解除してください。",
    payment_failed: "決済に失敗しました。",
    wallet_address_required: "ウォレットアドレスが必要です。",
    exchange_creds_required: "取引所・APIキー・シークレットが必要です。",
    invalid_link: "リンクが無効、または期限切れです。",
    password_short: "パスワードは8文字以上にしてください。",
    email_password_required: "有効なメールとパスワード（8文字以上）が必要です。",
    email_taken: "このメールはすでに登録されています。",
    invalid_credentials: "メールまたはパスワードが正しくありません。",
    email_unverified:
      "メール未確認です。受信箱（ローカル開発は data/mail）を確認してからログインしてください。",
  },
  en: {
    too_many: "Too many attempts. Retry in {sec}s.",
    register_failed: "Register failed.",
    login_failed: "Login failed.",
    request_failed: "Request failed.",
    resend_failed: "Resend failed.",
    reset_failed: "Reset failed.",
    account_created:
      "Account created. A verification email was sent — open your inbox (and spam), click the link, then log in. If nothing arrives, use “Resend verify email”.",
    reset_sent: "If that email exists, a reset link was sent.",
    verify_sent: "Verification email sent.",
    verify_sent_if: "If that account needs verification, a link was sent.",
    password_updated: "Password updated. Log in.",
    login_required: "Login required.",
    verify_before_save: "Verify your email before saving.",
    pro_required:
      "Pro plan required for filing-year totals and export. Pay with USDC to unlock.",
    payment_failed: "Payment failed.",
    wallet_address_required: "Wallet address is required.",
    exchange_creds_required: "exchange, apiKey, and apiSecret are required.",
    invalid_link: "Invalid or expired link.",
    password_short: "Password must be 8+ characters.",
    email_password_required: "Valid email and password (8+ chars) required.",
    email_taken: "Email already registered.",
    invalid_credentials: "Invalid email or password.",
    email_unverified:
      "Email not verified. Check your inbox (or data/mail in local dev), then verify before logging in.",
  },
} as const;

export function localeFromRequest(req: Request): Locale {
  const cookie = req.headers.get("cookie") ?? "";
  const m = /(?:^|;\s*)zei_locale=(ja|en)(?:;|$)/.exec(cookie);
  return m?.[1] === "en" ? "en" : "ja";
}

export function apiT(
  locale: Locale,
  key: ApiMsgKey,
  vars?: Record<string, string | number>,
): string {
  return formatMessage(apiMessages[locale][key], vars);
}

export function apiJsonError(
  req: Request,
  key: ApiMsgKey,
  status: number,
  vars?: Record<string, string | number>,
) {
  return NextResponse.json(
    { error: apiT(localeFromRequest(req), key, vars) },
    { status },
  );
}

/** Errors thrown as `api:<key>` are localized; otherwise fallback key. */
export function localizeThrown(
  req: Request,
  e: unknown,
  fallback: ApiMsgKey,
): string {
  const locale = localeFromRequest(req);
  if (e instanceof Error && e.message.startsWith("api:")) {
    const key = e.message.slice(4) as ApiMsgKey;
    if (key in apiMessages.ja) return apiT(locale, key);
  }
  return apiT(locale, fallback);
}

export function apiThrow(key: ApiMsgKey): never {
  throw new Error(`api:${key}`);
}
