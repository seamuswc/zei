#!/usr/bin/env node
/**
 * ZEI ops alerts — hourly cron on the droplet.
 *
 * Checks:
 *  1. Daily signups ≥ 10 (Asia/Tokyo calendar day) — once per day
 *  2. Total users crossing 100 / 200 / 300 … milestones
 *  3. Etherscan credits low / time-to-upgrade (debounced 12h; merged email)
 *  4. CoinGecko monthly credits low / time-to-upgrade (debounced 12h; merged)
 *  5. Scale soft advice: users ≥ 200 or daily signups ≥ 20 (debounced 24h)
 *
 * Emails ONLY OPS_ALERT_EMAIL / seamuswconnolly@gmail.com — never seamus@cryptozei.com.
 *
 * Usage (from app root, e.g. /var/www/zei):
 *   node scripts/ops-alerts.mjs
 *   node scripts/ops-alerts.mjs --dry-run
 *
 * Env (.env.local): RESEND_API_KEY, EMAIL_FROM, ETHERSCAN_API_KEY,
 * COINGECKO_API_KEY, OPS_ALERT_EMAIL
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DB_PATH = process.env.ZEI_DB || path.join(ROOT, "data", "zei.db");
const STATE_PATH =
  process.env.OPS_ALERTS_STATE ||
  path.join(ROOT, "data", "ops-alerts-state.json");
const ENV_PATH = path.join(ROOT, ".env.local");

/** Only this inbox receives ops alerts. */
const OPS_ONLY = "seamuswconnolly@gmail.com";
const BLOCKED_OPS = new Set([
  "seamus@cryptozei.com",
  "support@cryptozei.com",
]);

const DAILY_SIGNUP_THRESHOLD = 10;
const USER_MILESTONE_STEP = 100;

/** Existing “API low” thresholds */
const API_LOW_PCT = 0.15;
const API_LOW_ABS = 10_000;

/** Etherscan Lite (~100k/day): upgrade when used ≥ 70% or available < 30k */
const ETH_UPGRADE_USED_PCT = 0.7;
const ETH_UPGRADE_URGENT_USED_PCT = 0.9;
const ETH_UPGRADE_AVAILABLE_ABS = 30_000;

/** CoinGecko: upgrade nudge when remaining monthly < 20% */
const CG_UPGRADE_REMAINING_PCT = 0.2;

/** Soft scale advice */
const SCALE_USER_THRESHOLD = 200;
const SCALE_DAILY_SIGNUP_THRESHOLD = 20;

const API_DEBOUNCE_MS = 12 * 60 * 60 * 1000; // 12h
const SCALE_DEBOUNCE_MS = 24 * 60 * 60 * 1000; // 24h

const dryRun = process.argv.includes("--dry-run");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(ENV_PATH);

function resolveOpsEmail() {
  const raw = (process.env.OPS_ALERT_EMAIL || OPS_ONLY).trim().toLowerCase();
  if (!raw || BLOCKED_OPS.has(raw) || raw !== OPS_ONLY) {
    if (raw && raw !== OPS_ONLY) {
      console.warn(
        `[ops-alerts] OPS_ALERT_EMAIL=${raw} ignored — forcing ${OPS_ONLY}`,
      );
    }
    return OPS_ONLY;
  }
  return OPS_ONLY;
}

const alertTo = resolveOpsEmail();
const from =
  process.env.EMAIL_FROM || "ZEI <noreply@support.cryptozei.com>";
const resendKey = (process.env.RESEND_API_KEY || "").trim();

/** @returns {Record<string, unknown>} */
function loadState() {
  const empty = {
    lastUserMilestone: 0,
    lastDailySignupAlertDate: null,
    lastEtherscanLowAlertAt: null,
    lastCoinGeckoLowAlertAt: null,
    lastEtherscanUpgradeAlertAt: null,
    lastCoinGeckoUpgradeAlertAt: null,
    lastScaleAlertAt: null,
  };
  try {
    if (!fs.existsSync(STATE_PATH)) return empty;
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    return { ...empty, ...raw };
  } catch {
    return empty;
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function tokyoDateString(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** ISO bounds for Asia/Tokyo calendar day → UTC Date for SQLite TEXT compare. */
function tokyoDayUtcBounds(tokyoYmd) {
  // Tokyo is always UTC+9 (no DST). Midnight Tokyo = previous day 15:00 UTC.
  const startUtc = new Date(`${tokyoYmd}T00:00:00+09:00`);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return {
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString(),
  };
}

function recentlyAlerted(iso, debounceMs = API_DEBOUNCE_MS) {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < debounceMs;
}

async function sendEmail({ subject, text }) {
  if (alertTo !== OPS_ONLY) {
    throw new Error(`Refusing to send ops alert to non-OPS inbox: ${alertTo}`);
  }
  if (dryRun) {
    console.log(`[dry-run] would email ${alertTo}: ${subject}`);
    console.log(text);
    return { ok: true, mode: "dry-run" };
  }
  if (!resendKey) {
    console.warn("[ops-alerts] RESEND_API_KEY missing — logging only");
    console.log(`TO: ${alertTo}\nSUBJECT: ${subject}\n\n${text}`);
    return { ok: true, mode: "console" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      reply_to: process.env.EMAIL_REPLY_TO || "support@cryptozei.com",
      to: [alertTo],
      subject,
      text,
      html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap;">${text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre>`,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed: ${body.slice(0, 300)}`);
  }
  console.log(`[ops-alerts] sent: ${subject} → ${alertTo}`);
  return { ok: true, mode: "resend" };
}

function queryUsers() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`SQLite not found: ${DB_PATH}`);
  }
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const total = db.prepare(`SELECT COUNT(*) AS n FROM users`).get().n;
    const tokyoToday = tokyoDateString();
    const { startIso, endIso } = tokyoDayUtcBounds(tokyoToday);
    // created_at is ISO TEXT; compare lexicographically with UTC ISO bounds
    const daily = db
      .prepare(
        `SELECT COUNT(*) AS n FROM users
         WHERE created_at >= ? AND created_at < ?`,
      )
      .get(startIso, endIso).n;
    return { total, dailySignups: daily, tokyoToday };
  } finally {
    db.close();
  }
}

async function checkEtherscan() {
  const key = (process.env.ETHERSCAN_API_KEY || "").trim();
  if (!key) {
    return { ok: false, skip: true, reason: "ETHERSCAN_API_KEY missing" };
  }
  const u = new URL("https://api.etherscan.io/v2/api");
  u.searchParams.set("chainid", "1");
  u.searchParams.set("module", "getapilimit");
  u.searchParams.set("action", "getapilimit");
  u.searchParams.set("apikey", key);
  const res = await fetch(u);
  const data = await res.json();
  if (String(data.status) !== "1" || !data.result) {
    return {
      ok: false,
      skip: false,
      reason: `Etherscan getapilimit error: ${JSON.stringify(data).slice(0, 200)}`,
    };
  }
  const creditsAvailable = Number(data.result.creditsAvailable);
  const creditLimit = Number(data.result.creditLimit);
  const creditsUsed = Number(data.result.creditsUsed);
  if (!Number.isFinite(creditsAvailable) || !Number.isFinite(creditLimit)) {
    return { ok: false, skip: false, reason: "Etherscan: unparseable credits" };
  }
  const remainingPct = creditLimit > 0 ? creditsAvailable / creditLimit : 0;
  const usedPct =
    creditLimit > 0 && Number.isFinite(creditsUsed)
      ? creditsUsed / creditLimit
      : creditLimit > 0
        ? (creditLimit - creditsAvailable) / creditLimit
        : 0;
  const low =
    creditsAvailable < API_LOW_ABS || remainingPct < API_LOW_PCT;
  const upgrade =
    usedPct >= ETH_UPGRADE_USED_PCT ||
    creditsAvailable < ETH_UPGRADE_AVAILABLE_ABS;
  const urgent = usedPct >= ETH_UPGRADE_URGENT_USED_PCT;
  return {
    ok: true,
    low,
    upgrade,
    urgent,
    creditsAvailable,
    creditLimit,
    creditsUsed: Number.isFinite(creditsUsed)
      ? creditsUsed
      : creditLimit - creditsAvailable,
    remainingPct,
    usedPct,
    interval: data.result.limitInterval || "?",
  };
}

async function checkCoinGecko() {
  const key = (process.env.COINGECKO_API_KEY || "").trim();
  if (!key) {
    return {
      ok: false,
      skip: true,
      unknown: true,
      reason: "CoinGecko status unknown (no COINGECKO_API_KEY)",
    };
  }
  const isDemo = key.startsWith("CG-");
  const base = isDemo
    ? "https://api.coingecko.com/api/v3"
    : "https://pro-api.coingecko.com/api/v3";
  const headers = { accept: "application/json" };
  if (isDemo) headers["x-cg-demo-api-key"] = key;
  else headers["x-cg-pro-api-key"] = key;

  try {
    const res = await fetch(`${base}/key`, { headers });
    if (!res.ok) {
      return {
        ok: false,
        skip: true,
        unknown: true,
        reason: `CoinGecko status unknown (/key HTTP ${res.status}) — skip upgrade check`,
      };
    }
    const data = await res.json();
    const d = data.data || data;
    // Prefer remaining fields; fall back to credit − used
    let remaining =
      d.monthly_call_credit_remaining ??
      d.current_remaining_monthly_calls ??
      null;
    const limit =
      d.monthly_call_credit ??
      d.plan_monthly_limit ??
      d.total_monthly_calls ??
      null;
    const used =
      d.current_total_monthly_calls ??
      d.current_month_api_usage ??
      null;
    if (remaining == null && limit != null && used != null) {
      remaining = Number(limit) - Number(used);
    }
    remaining = remaining != null ? Number(remaining) : null;
    const limitN = limit != null ? Number(limit) : null;
    if (remaining == null || !Number.isFinite(remaining)) {
      return {
        ok: false,
        skip: true,
        unknown: true,
        reason: "CoinGecko status unknown (no remaining credits in /key) — skip",
        raw: JSON.stringify(d).slice(0, 240),
      };
    }
    const remainingPct =
      limitN && Number.isFinite(limitN) && limitN > 0
        ? remaining / limitN
        : null;
    const low =
      remaining < API_LOW_ABS ||
      (remainingPct != null && remainingPct < API_LOW_PCT);
    const upgrade =
      remainingPct != null && remainingPct < CG_UPGRADE_REMAINING_PCT;
    const plan = d.plan || (isDemo ? "Demo/Basic" : "Pro");
    return {
      ok: true,
      low,
      upgrade,
      remaining,
      limit: limitN,
      remainingPct,
      plan,
    };
  } catch (e) {
    return {
      ok: false,
      skip: true,
      unknown: true,
      reason: `CoinGecko status unknown (${e.message}) — skip upgrade check`,
    };
  }
}

function etherscanEmail({ eth, includeLow, includeUpgrade }) {
  const usedPctStr = `${(eth.usedPct * 100).toFixed(1)}%`;
  const remPctStr = `${(eth.remainingPct * 100).toFixed(1)}%`;
  const urgent = includeUpgrade && eth.urgent;
  const parts = [];
  if (includeUpgrade && includeLow) {
    parts.push(urgent ? "URGENT upgrade + low" : "upgrade + low");
  } else if (includeUpgrade) {
    parts.push(urgent ? "URGENT: time to upgrade" : "time to upgrade");
  } else {
    parts.push("credits low");
  }
  const subject = `[ZEI ops] Etherscan ${parts.join("")} — ${eth.creditsAvailable.toLocaleString()} left (${usedPctStr} used)`;

  const lines = [
    "ZEI ops alert: Etherscan API",
    "",
    `What: ${includeUpgrade ? "Etherscan plan upgrade" : "Etherscan credits low"}${includeLow && includeUpgrade ? " (+ credits low)" : ""}`,
    "",
    `Credits available: ${eth.creditsAvailable.toLocaleString()}`,
    `Credit limit: ${eth.creditLimit.toLocaleString()}`,
    `Credits used: ${eth.creditsUsed.toLocaleString()} (${usedPctStr} of daily limit)`,
    `Remaining: ${remPctStr}`,
    `Interval: ${eth.interval}`,
    "",
  ];

  if (includeUpgrade) {
    lines.push(
      urgent
        ? "URGENT: daily usage ≥ 90% of limit."
        : "It is time to upgrade the Etherscan API plan.",
      "",
      "Recommended: Lite → Standard",
      "  Standard: ~200,000 credits/day, 10 calls/sec",
      "  (current Lite-class limit is typically ~100,000/day)",
      "",
      `Trigger: used ≥ ${ETH_UPGRADE_USED_PCT * 100}% of limit OR available < ${ETH_UPGRADE_AVAILABLE_ABS.toLocaleString()}.`,
      "",
    );
  }
  if (includeLow) {
    lines.push(
      `Credits-low trigger: remaining < ${API_LOW_ABS.toLocaleString()} OR < ${API_LOW_PCT * 100}% of limit.`,
      "",
    );
  }
  lines.push("https://etherscan.io/apidashboard");
  return { subject, text: lines.join("\n") };
}

function coinGeckoEmail({ cg, includeLow, includeUpgrade }) {
  const pctStr =
    cg.remainingPct != null
      ? `${(cg.remainingPct * 100).toFixed(1)}%`
      : "n/a";
  const parts = [];
  if (includeUpgrade && includeLow) parts.push("upgrade + low");
  else if (includeUpgrade) parts.push("time to upgrade");
  else parts.push("credits low");
  const subject = `[ZEI ops] CoinGecko ${parts.join("")} — ${cg.remaining.toLocaleString()} left (${pctStr})`;

  const lines = [
    "ZEI ops alert: CoinGecko API",
    "",
    `What: ${includeUpgrade ? "CoinGecko plan upgrade" : "CoinGecko credits low"}${includeLow && includeUpgrade ? " (+ credits low)" : ""}`,
    "",
    `Plan (reported): ${cg.plan}`,
    `Credits remaining: ${cg.remaining.toLocaleString()}`,
    `Monthly credit limit: ${cg.limit != null ? cg.limit.toLocaleString() : "unknown"}`,
    `Remaining %: ${pctStr}`,
    "",
  ];
  if (includeUpgrade) {
    lines.push(
      "It is time to upgrade CoinGecko (Basic/Demo → Analyst or higher).",
      "Monthly credits are running low — wallet JPY pricing falls back on this API.",
      "",
      `Upgrade trigger: remaining monthly credits < ${CG_UPGRADE_REMAINING_PCT * 100}%.`,
      "",
    );
  }
  if (includeLow) {
    lines.push(
      `Credits-low trigger: remaining < ${API_LOW_ABS.toLocaleString()} OR < ${API_LOW_PCT * 100}% of limit.`,
      "",
    );
  }
  lines.push("https://www.coingecko.com/en/api/pricing");
  return { subject, text: lines.join("\n") };
}

async function main() {
  console.log(
    `[ops-alerts] start dryRun=${dryRun} to=${alertTo} db=${DB_PATH}`,
  );
  const state = loadState();
  const { total, dailySignups, tokyoToday } = queryUsers();
  console.log(
    `[ops-alerts] users total=${total} daily(Tokyo ${tokyoToday})=${dailySignups} milestone=${state.lastUserMilestone}`,
  );

  // 1) Daily signups
  if (
    dailySignups >= DAILY_SIGNUP_THRESHOLD &&
    state.lastDailySignupAlertDate !== tokyoToday
  ) {
    await sendEmail({
      subject: `[ZEI ops] Daily signups ≥ ${DAILY_SIGNUP_THRESHOLD} (${dailySignups} on ${tokyoToday} JST)`,
      text: [
        "ZEI ops alert: daily signups",
        "",
        `Date (Asia/Tokyo): ${tokyoToday}`,
        `New users today: ${dailySignups}`,
        `Threshold: ${DAILY_SIGNUP_THRESHOLD}`,
        `Total users: ${total}`,
        "",
        "https://www.cryptozei.com",
      ].join("\n"),
    });
    state.lastDailySignupAlertDate = tokyoToday;
  } else {
    console.log(
      `[ops-alerts] daily signups: skip (count=${dailySignups}, last=${state.lastDailySignupAlertDate})`,
    );
  }

  // 2) User milestones (+100)
  const crossed = Math.floor(total / USER_MILESTONE_STEP) * USER_MILESTONE_STEP;
  if (crossed >= USER_MILESTONE_STEP && crossed > (state.lastUserMilestone || 0)) {
    await sendEmail({
      subject: `[ZEI ops] Total users reached ${crossed}`,
      text: [
        "ZEI ops alert: user milestone",
        "",
        `Total users: ${total}`,
        `Milestone: ${crossed}`,
        `Previous notified milestone: ${state.lastUserMilestone || 0}`,
        "",
        "https://www.cryptozei.com",
      ].join("\n"),
    });
    state.lastUserMilestone = crossed;
  } else {
    console.log(
      `[ops-alerts] milestone: skip (total=${total}, last=${state.lastUserMilestone})`,
    );
  }

  // 3) Scale / droplet soft advice (users ≥ 200 OR daily ≥ 20)
  const scaleHit =
    total >= SCALE_USER_THRESHOLD ||
    dailySignups >= SCALE_DAILY_SIGNUP_THRESHOLD;
  if (scaleHit && !recentlyAlerted(state.lastScaleAlertAt, SCALE_DEBOUNCE_MS)) {
    const why = [];
    if (total >= SCALE_USER_THRESHOLD) {
      why.push(
        `Total users ${total} ≥ ${SCALE_USER_THRESHOLD}`,
      );
    }
    if (dailySignups >= SCALE_DAILY_SIGNUP_THRESHOLD) {
      why.push(
        `Daily signups ${dailySignups} ≥ ${SCALE_DAILY_SIGNUP_THRESHOLD} (Tokyo ${tokyoToday})`,
      );
    }
    await sendEmail({
      subject: `[ZEI ops] Scale advice — consider larger droplet (users=${total}, daily=${dailySignups})`,
      text: [
        "ZEI ops alert: scale / droplet (soft advice)",
        "",
        "What: Consider a larger DigitalOcean droplet and watch wallet-sync concurrency.",
        "Why:",
        ...why.map((w) => `  - ${w}`),
        "",
        "This is advisory — not an outage. Growth may increase SQLite + Etherscan load.",
        "Suggested: bump droplet size if CPU/RAM is tight; keep an eye on sync concurrency.",
        "",
        "https://www.cryptozei.com",
      ].join("\n"),
    });
    state.lastScaleAlertAt = new Date().toISOString();
  } else if (scaleHit) {
    console.log(
      `[ops-alerts] scale: hit but debounced (last=${state.lastScaleAlertAt})`,
    );
  } else {
    console.log(
      `[ops-alerts] scale: skip (total=${total}, daily=${dailySignups})`,
    );
  }

  // 4) Etherscan — merge low + upgrade into one email when both fire
  const eth = await checkEtherscan();
  if (eth.skip) {
    console.log(`[ops-alerts] Etherscan: ${eth.reason}`);
  } else if (!eth.ok) {
    console.warn(`[ops-alerts] Etherscan check failed: ${eth.reason}`);
  } else {
    console.log(
      `[ops-alerts] Etherscan available=${eth.creditsAvailable}/${eth.creditLimit} used=${(eth.usedPct * 100).toFixed(1)}% low=${eth.low} upgrade=${eth.upgrade} urgent=${eth.urgent}`,
    );
    const lowDue =
      eth.low && !recentlyAlerted(state.lastEtherscanLowAlertAt);
    const upgradeDue =
      eth.upgrade && !recentlyAlerted(state.lastEtherscanUpgradeAlertAt);
    if (lowDue || upgradeDue) {
      const includeUpgrade = eth.upgrade && (upgradeDue || lowDue);
      const includeLow = eth.low && (lowDue || upgradeDue);
      await sendEmail(etherscanEmail({ eth, includeLow, includeUpgrade }));
      const now = new Date().toISOString();
      if (includeLow) state.lastEtherscanLowAlertAt = now;
      if (includeUpgrade) state.lastEtherscanUpgradeAlertAt = now;
    } else if (eth.low || eth.upgrade) {
      console.log(
        `[ops-alerts] Etherscan low/upgrade debounced (lowAt=${state.lastEtherscanLowAlertAt}, upAt=${state.lastEtherscanUpgradeAlertAt})`,
      );
    }
  }

  // 5) CoinGecko — merge low + upgrade; skip when /key unknown
  const cg = await checkCoinGecko();
  if (cg.unknown || cg.skip) {
    console.log(`[ops-alerts] CoinGecko: ${cg.reason}`);
  } else if (cg.ok) {
    const pctStr =
      cg.remainingPct != null
        ? `${(cg.remainingPct * 100).toFixed(1)}%`
        : "n/a";
    console.log(
      `[ops-alerts] CoinGecko (${cg.plan}) remaining=${cg.remaining}/${cg.limit} (${pctStr}) low=${cg.low} upgrade=${cg.upgrade}`,
    );
    const lowDue =
      cg.low && !recentlyAlerted(state.lastCoinGeckoLowAlertAt);
    const upgradeDue =
      cg.upgrade && !recentlyAlerted(state.lastCoinGeckoUpgradeAlertAt);
    if (lowDue || upgradeDue) {
      const includeUpgrade = cg.upgrade && (upgradeDue || lowDue);
      const includeLow = cg.low && (lowDue || upgradeDue);
      await sendEmail(coinGeckoEmail({ cg, includeLow, includeUpgrade }));
      const now = new Date().toISOString();
      if (includeLow) state.lastCoinGeckoLowAlertAt = now;
      if (includeUpgrade) state.lastCoinGeckoUpgradeAlertAt = now;
    } else if (cg.low || cg.upgrade) {
      console.log(
        `[ops-alerts] CoinGecko low/upgrade debounced (lowAt=${state.lastCoinGeckoLowAlertAt}, upAt=${state.lastCoinGeckoUpgradeAlertAt})`,
      );
    }
  }

  if (!dryRun) {
    saveState(state);
    console.log(`[ops-alerts] state saved → ${STATE_PATH}`);
  } else {
    console.log("[ops-alerts] dry-run: state not written");
  }
  console.log("[ops-alerts] done");
}

main().catch((err) => {
  console.error("[ops-alerts] fatal:", err);
  process.exit(1);
});
