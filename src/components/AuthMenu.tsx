"use client";

import { useEffect, useState } from "react";
import type { CryptoTx } from "@/lib/tax/types";
import type { YearCarryRow } from "@/lib/tax/loss-carry";
import { usePortfolio } from "./PortfolioProvider";

type User = {
  id: string;
  email: string;
  plan: "free" | "pro";
  planExpiresAt: string | null;
  emailVerified: boolean;
};

export function AuthMenu() {
  const {
    txs,
    otherIncomeJpy,
    incomeProvided,
    year,
    hydrateFromServer,
    setTaxYears,
  } = usePortfolio();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function refreshMe() {
    const res = await fetch("/api/auth/me");
    const data = (await res.json()) as {
      user: User | null;
      ledger?: {
        txs: CryptoTx[];
        otherIncomeJpy: number;
        incomeProvided: boolean;
        year: number;
      };
      taxYears?: YearCarryRow[];
    };
    setUser(data.user);
    if (data.user?.plan === "pro" && data.ledger) {
      hydrateFromServer(data.ledger);
    }
    if (data.taxYears) setTaxYears(data.taxYears);
  }

  useEffect(() => {
    void refreshMe();
    const q = new URLSearchParams(window.location.search);
    if (q.get("verify") === "ok") setMsg("Email verified — you can log in.");
    if (q.get("verify") === "bad") setMsg("Verification link invalid or expired.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function auth() {
    setBusy(true);
    setMsg(null);
    setDevLink(null);
    try {
      if (mode === "forgot") {
        const res = await fetch("/api/auth/forgot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = (await res.json()) as { error?: string; message?: string };
        if (!res.ok) throw new Error(data.error || "Request failed");
        setMsg(data.message || "Check your email.");
        return;
      }
      const res = await fetch(
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        verifyLinkDev?: string;
        needsVerify?: boolean;
      };
      if (!res.ok) throw new Error(data.error || "Auth failed");
      setPassword("");
      if (data.verifyLinkDev) setDevLink(data.verifyLinkDev);
      if (mode === "register" || data.needsVerify) {
        setMsg(
          data.message ||
            "Account created. Verify your email, then log in.",
        );
        setMode("login");
      } else {
        await refreshMe();
        setMsg("Logged in.");
        setOpen(false);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/resend-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        verifyLinkDev?: string;
      };
      if (!res.ok) throw new Error(data.error || "Resend failed");
      if (data.verifyLinkDev) setDevLink(data.verifyLinkDev);
      setMsg(data.message || "Sent.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Resend failed");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setOpen(false);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ledger", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txs,
          otherIncomeJpy,
          incomeProvided,
          year,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg("Ledger saved.");
      await refreshMe();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/pay/create", { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        invoiceUrl?: string;
      };
      if (!res.ok) throw new Error(data.error || "Payment failed");
      if (data.invoiceUrl) window.location.href = data.invoiceUrl;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-menu">
      <button
        type="button"
        className="btn btn--solid btn--sm"
        onClick={() => setOpen((v) => !v)}
      >
        {user ? user.email.split("@")[0] : "Log in"}
      </button>
      {open && (
        <div className="auth-panel">
          {!user ? (
            <>
              <div className="preset-row">
                <button
                  type="button"
                  className={
                    mode === "login"
                      ? "btn btn--solid btn--sm"
                      : "btn btn--ghost btn--sm"
                  }
                  onClick={() => setMode("login")}
                >
                  Log in
                </button>
                <button
                  type="button"
                  className={
                    mode === "register"
                      ? "btn btn--solid btn--sm"
                      : "btn btn--ghost btn--sm"
                  }
                  onClick={() => setMode("register")}
                >
                  Create account
                </button>
              </div>
              <label className="field">
                <span>Email</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              {mode !== "forgot" && (
                <label className="field">
                  <span>Password (8+)</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                  />
                </label>
              )}
              <button
                type="button"
                className="btn btn--solid"
                disabled={busy}
                onClick={() => void auth()}
              >
                {busy
                  ? "…"
                  : mode === "login"
                    ? "Log in"
                    : mode === "register"
                      ? "Create account"
                      : "Send reset link"}
              </button>
              <div className="auth-links">
                {mode === "login" && (
                  <>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => setMode("forgot")}
                    >
                      Forgot password
                    </button>
                    <button
                      type="button"
                      className="linkish"
                      disabled={busy || !email}
                      onClick={() => void resend()}
                    >
                      Resend verify email
                    </button>
                  </>
                )}
                {mode !== "login" && (
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => setMode("login")}
                  >
                    Back to log in
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="auth-user">
                <strong>{user.email}</strong>
                <br />
                {user.emailVerified ? "Verified" : "Unverified"} · {user.plan}
              </p>
              <div className="import-actions">
                {user.plan !== "pro" && (
                  <button
                    type="button"
                    className="btn btn--solid btn--sm"
                    disabled={busy}
                    onClick={() => void pay()}
                  >
                    Pay crypto (Pro)
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--solid btn--sm"
                  disabled={busy || user.plan !== "pro"}
                  onClick={() => void save()}
                >
                  Save ledger
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => void logout()}
                >
                  Log out
                </button>
              </div>
            </>
          )}
          {msg && <p className="status-ok">{msg}</p>}
          {devLink && (
            <p className="field-hint">
              Dev verify link:{" "}
              <a href={devLink}>click to verify</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
