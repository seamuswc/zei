import fs from "fs";
import path from "path";

export type MailResult = {
  ok: boolean;
  mode: "resend" | "console" | "file";
  previewPath?: string;
};

export function appBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL ||
    process.env.ZEI_PAY_SUCCESS_URL?.replace(/\/\?.*$/, "") ||
    "https://www.cryptozei.com";
  return raw.replace(/\/$/, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared bilingual transactional email layout. */
export function zeiMailHtml(options: {
  preheader: string;
  titleJa: string;
  titleEn: string;
  bodyJa: string[];
  bodyEn: string[];
  ctaLabelJa: string;
  ctaLabelEn: string;
  ctaUrl: string;
  footJa: string;
  footEn: string;
}): string {
  const url = escapeHtml(options.ctaUrl);
  const paras = (lines: string[]) =>
    lines.map((p) => `<p style="margin:0 0 12px;line-height:1.55;color:#243a47;">${p}</p>`).join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(options.titleJa)}</title>
</head>
<body style="margin:0;padding:0;background:#e8eef1;font-family:'Hiragino Sans','Helvetica Neue',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e8eef1;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#f4f7f8;border:1px solid #c5d2d9;">
          <tr>
            <td style="padding:22px 28px 10px;border-bottom:1px solid #c5d2d9;">
              <div style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#0c1f2a;">ZEI</div>
              <div style="margin-top:4px;font-size:13px;color:#243a47;">暗号資産の税務 · Crypto tax for Japan</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <h1 style="margin:0 0 14px;font-size:20px;line-height:1.35;color:#0c1f2a;">${escapeHtml(options.titleJa)}</h1>
              ${paras(options.bodyJa.map(escapeHtml))}
              <p style="margin:20px 0 28px;">
                <a href="${url}" style="display:inline-block;padding:12px 18px;background:#0f8f6c;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">${escapeHtml(options.ctaLabelJa)}</a>
              </p>
              <hr style="border:none;border-top:1px solid #c5d2d9;margin:8px 0 20px;" />
              <h2 style="margin:0 0 12px;font-size:18px;line-height:1.35;color:#0c1f2a;">${escapeHtml(options.titleEn)}</h2>
              ${paras(options.bodyEn.map(escapeHtml))}
              <p style="margin:20px 0 8px;">
                <a href="${url}" style="display:inline-block;padding:12px 18px;background:#0f8f6c;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">${escapeHtml(options.ctaLabelEn)}</a>
              </p>
              <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#5a6f7a;word-break:break-all;">
                ${escapeHtml(options.footJa)}<br />
                ${escapeHtml(options.footEn)}<br />
                <span style="color:#0c1f2a;">${url}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 28px 20px;border-top:1px solid #c5d2d9;font-size:12px;color:#5a6f7a;">
              ZEI · www.cryptozei.com · support@cryptozei.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function verifyEmailContent(link: string): {
  subject: string;
  text: string;
  html: string;
} {
  return {
    subject: "【ZEI】メールアドレスの確認 / Verify your email",
    text: [
      "ZEI アカウントの確認",
      "",
      "アカウント作成ありがとうございます。下のリンクを開いてメールアドレスを確認してください（48時間有効）。",
      link,
      "",
      "---",
      "",
      "Verify your ZEI account",
      "",
      "Thanks for signing up. Open this link to verify your email (valid 48 hours):",
      link,
      "",
      "If you did not create this account, you can ignore this email.",
      "このメールに心当たりがない場合は無視してください。",
    ].join("\n"),
    html: zeiMailHtml({
      preheader: "ZEIのメール確認リンクです / Verify your ZEI email",
      titleJa: "メールアドレスの確認",
      titleEn: "Verify your email",
      bodyJa: [
        "アカウント作成ありがとうございます。",
        "下のボタンを押してメールアドレスを確認してください。リンクの有効期限は48時間です。",
        "確認後、ZEIにログインできます。",
      ],
      bodyEn: [
        "Thanks for creating a ZEI account.",
        "Tap the button below to verify your email. This link expires in 48 hours.",
        "After verifying, you can log in to ZEI.",
      ],
      ctaLabelJa: "メールを確認する",
      ctaLabelEn: "Verify email",
      ctaUrl: link,
      footJa: "ボタンが使えない場合は、次のURLをブラウザに貼り付けてください。",
      footEn: "If the button does not work, paste this URL into your browser:",
    }),
  };
}

export function resetEmailContent(link: string): {
  subject: string;
  text: string;
  html: string;
} {
  return {
    subject: "【ZEI】パスワード再設定 / Reset your password",
    text: [
      "ZEI パスワード再設定",
      "",
      "パスワード再設定のリクエストを受け付けました。下のリンクから新しいパスワードを設定してください（2時間有効）。",
      link,
      "",
      "---",
      "",
      "Reset your ZEI password",
      "",
      "We received a password reset request. Open this link to set a new password (valid 2 hours):",
      link,
      "",
      "If you did not request this, ignore this email.",
      "心当たりがない場合は、このメールを無視してください。",
    ].join("\n"),
    html: zeiMailHtml({
      preheader: "ZEIのパスワード再設定 / Reset your ZEI password",
      titleJa: "パスワード再設定",
      titleEn: "Reset your password",
      bodyJa: [
        "パスワード再設定のリクエストを受け付けました。",
        "下のボタンから新しいパスワードを設定してください。リンクの有効期限は2時間です。",
        "ご自身でリクエストしていない場合は、このメールを無視してください。",
      ],
      bodyEn: [
        "We received a request to reset your password.",
        "Use the button below to choose a new password. This link expires in 2 hours.",
        "If you did not request this, you can ignore this email.",
      ],
      ctaLabelJa: "パスワードを再設定",
      ctaLabelEn: "Reset password",
      ctaUrl: link,
      footJa: "ボタンが使えない場合は、次のURLをブラウザに貼り付けてください。",
      footEn: "If the button does not work, paste this URL into your browser:",
    }),
  };
}

/**
 * Send transactional email.
 * Best: RESEND_API_KEY + EMAIL_FROM
 * Local fallback: write to data/mail/ and log link
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM || "ZEI <noreply@support.cryptozei.com>";
  const replyTo =
    process.env.EMAIL_REPLY_TO || "support@cryptozei.com";

  if (apiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        reply_to: replyTo,
        to: [options.to],
        subject: options.subject,
        text: options.text,
        html: options.html || `<pre>${options.text}</pre>`,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend failed: ${body.slice(0, 200)}`);
    }
    return { ok: true, mode: "resend" };
  }

  const dir = path.join(process.cwd(), "data", "mail");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `${Date.now()}_${options.to.replace(/[^a-z0-9@._-]/gi, "_")}.txt`,
  );
  const body = `TO: ${options.to}\nSUBJECT: ${options.subject}\n\n${options.text}\n`;
  fs.writeFileSync(file, body, "utf8");
  console.info(
    "[zei-mail:dev]",
    options.subject,
    "→",
    options.to,
    "\n",
    options.text,
  );
  return { ok: true, mode: "file", previewPath: file };
}
