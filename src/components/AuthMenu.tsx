"use client";

import { useEffect, useState } from "react";
import { filingTaxYear } from "@/lib/billing";
import { useI18n } from "./I18nProvider";
import { useAuth } from "./AuthProvider";

export function AuthMenu() {
  const { user, isPro, refreshMe, startProPay, setUser } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("verify") === "ok") setMsg(t("auth_verify_ok"));
    if (q.get("verify") === "bad") setMsg(t("auth_verify_bad"));
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
        setMsg(data.message || "OK");
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
        setMsg(t("auth_created"));
        setMode("login");
      } else {
        await refreshMe();
        setMsg(t("auth_logged_in"));
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
      setMsg(data.message || "OK");
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

  async function pay() {
    setBusy(true);
    setMsg(null);
    try {
      await startProPay();
      setOpen(false);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  const filingYear = filingTaxYear();

  return (
    <div className="auth-menu">
      <button
        type="button"
        className="btn btn--solid btn--sm"
        onClick={() => setOpen((v) => !v)}
      >
        {user ? user.email.split("@")[0] : t("auth_login")}
      </button>
      {open && (
        <div className="auth-panel">
          {!user ? (
            <>
              <p className="auth-pricing">{t("auth_pricing", { year: filingYear })}</p>
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
                  {t("auth_login")}
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
                  {t("auth_register")}
                </button>
              </div>
              <label className="field">
                <span>{t("auth_email")}</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              {mode !== "forgot" && (
                <label className="field">
                  <span>{t("auth_password")}</span>
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
              {mode === "register" && (
                <p className="field-hint auth-register-hint">
                  {t("auth_register_hint")}
                </p>
              )}
              <button
                type="button"
                className="btn btn--solid"
                disabled={busy}
                onClick={() => void auth()}
              >
                {busy
                  ? t("auth_creating")
                  : mode === "login"
                    ? t("auth_login")
                    : mode === "register"
                      ? t("auth_register")
                      : t("auth_send_reset")}
              </button>
              <div className="auth-links">
                {mode === "login" && (
                  <>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => setMode("forgot")}
                    >
                      {t("auth_forgot")}
                    </button>
                    <button
                      type="button"
                      className="linkish"
                      disabled={busy || !email}
                      onClick={() => void resend()}
                    >
                      {t("auth_resend")}
                    </button>
                  </>
                )}
                {mode !== "login" && (
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => setMode("login")}
                  >
                    {t("auth_back")}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="auth-user">
                <strong>{user.email}</strong>
                <br />
                {user.emailVerified ? t("auth_verified") : t("auth_unverified")} ·{" "}
                {isPro
                  ? t("auth_plan_pro")
                  : t("auth_plan_free", { year: filingYear })}
              </p>
              {!isPro && (
                <p className="auth-pricing">{t("auth_pricing", { year: filingYear })}</p>
              )}
              <div className="import-actions">
                {!isPro && (
                  <button
                    type="button"
                    className="btn btn--solid btn--sm"
                    disabled={busy}
                    onClick={() => void pay()}
                  >
                    {busy ? (
                      <span className="btn-loading">
                        <span className="spinner" aria-hidden />
                        {t("auth_creating")}
                      </span>
                    ) : (
                      t("auth_pay")
                    )}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => void logout()}
                >
                  {t("auth_logout")}
                </button>
              </div>
              {user.emailVerified && (
                <p className="field-hint">{t("auth_autosave_hint")}</p>
              )}
            </>
          )}
          {msg && (
            <p
              className={
                /fail|error|失敗|必要|missing|invalid|無効/i.test(msg)
                  ? "status-err-line"
                  : "status-ok"
              }
            >
              {msg}
            </p>
          )}
          {devLink && (
            <p className="field-hint">
              {t("auth_dev_link")}{" "}
              <a href={devLink}>{t("auth_click_verify")}</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
