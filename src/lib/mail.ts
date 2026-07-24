import fs from "fs";
import path from "path";

export type MailResult = {
  ok: boolean;
  mode: "resend" | "console" | "file";
  previewPath?: string;
};

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
    process.env.EMAIL_FROM || "ZEI <onboarding@resend.dev>";

  if (apiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
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
  const file = path.join(dir, `${Date.now()}_${options.to.replace(/[^a-z0-9@._-]/gi, "_")}.txt`);
  const body = `TO: ${options.to}\nSUBJECT: ${options.subject}\n\n${options.text}\n`;
  fs.writeFileSync(file, body, "utf8");
  console.info("[zei-mail:dev]", options.subject, "→", options.to, "\n", options.text);
  return { ok: true, mode: "file", previewPath: file };
}

export function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    process.env.ZEI_PAY_SUCCESS_URL?.replace(/\/\?.*$/, "") ||
    "http://localhost:3000"
  );
}
