import { getDb } from "@/lib/db";
import { unlockPro } from "@/lib/auth";
import { randomBytes } from "crypto";

const PRICE_USD = Number(process.env.ZEI_PRO_PRICE_USD || 99);

export async function createCryptoInvoice(options: {
  userId: string;
  email: string;
}): Promise<{ invoiceUrl: string; paymentId: string; provider: string }> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  const ipn = process.env.NOWPAYMENTS_IPN_CALLBACK_URL;
  const paymentId = randomBytes(12).toString("hex");

  if (!apiKey) {
    if (process.env.ALLOW_DEV_PAY === "1") {
      const db = getDb();
      db.prepare(
        `INSERT INTO payments (id, user_id, provider, invoice_id, amount, currency, status, raw_json, created_at)
         VALUES (?, ?, 'dev', ?, ?, 'usd', 'waiting', '{}', ?)`,
      ).run(
        paymentId,
        options.userId,
        paymentId,
        PRICE_USD,
        new Date().toISOString(),
      );
      return {
        invoiceUrl: `/api/pay/dev-complete?paymentId=${paymentId}`,
        paymentId,
        provider: "dev",
      };
    }
    throw new Error(
      "NOWPAYMENTS_API_KEY not set. Add it to .env.local (or ALLOW_DEV_PAY=1 for local testing).",
    );
  }

  const res = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      price_amount: PRICE_USD,
      price_currency: "usd",
      order_id: paymentId,
      order_description: "ZEI Pro — Japan crypto tax (1 year)",
      ipn_callback_url: ipn,
      success_url: process.env.ZEI_PAY_SUCCESS_URL || "http://localhost:3000/?paid=1",
      cancel_url: process.env.ZEI_PAY_CANCEL_URL || "http://localhost:3000/?paid=0",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NOWPayments error: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    id: string | number;
    invoice_url: string;
  };

  const db = getDb();
  db.prepare(
    `INSERT INTO payments (id, user_id, provider, invoice_id, amount, currency, status, raw_json, created_at)
     VALUES (?, ?, 'nowpayments', ?, ?, 'usd', 'waiting', ?, ?)`,
  ).run(
    paymentId,
    options.userId,
    String(data.id),
    PRICE_USD,
    JSON.stringify(data),
    new Date().toISOString(),
  );

  return {
    invoiceUrl: data.invoice_url,
    paymentId,
    provider: "nowpayments",
  };
}

export function markPaymentFinished(options: {
  orderId: string;
  status: string;
  raw?: unknown;
}) {
  const db = getDb();
  const row = db
    .prepare(`SELECT user_id, status FROM payments WHERE id = ? OR invoice_id = ?`)
    .get(options.orderId, options.orderId) as
    | { user_id: string; status: string }
    | undefined;
  if (!row) return false;

  const paid = /finished|confirmed|completed|finished/i.test(options.status);
  db.prepare(
    `UPDATE payments SET status = ?, raw_json = ? WHERE id = ? OR invoice_id = ?`,
  ).run(
    options.status,
    JSON.stringify(options.raw ?? {}),
    options.orderId,
    options.orderId,
  );

  if (paid) {
    unlockPro(row.user_id, 365);
    return true;
  }
  return false;
}

export function completeDevPayment(paymentId: string, userId: string) {
  if (process.env.ALLOW_DEV_PAY !== "1") {
    throw new Error("Dev pay disabled");
  }
  const db = getDb();
  const row = db
    .prepare(`SELECT user_id FROM payments WHERE id = ?`)
    .get(paymentId) as { user_id: string } | undefined;
  if (!row || row.user_id !== userId) throw new Error("Payment not found");
  db.prepare(`UPDATE payments SET status = 'finished' WHERE id = ?`).run(
    paymentId,
  );
  unlockPro(userId, 365);
}
