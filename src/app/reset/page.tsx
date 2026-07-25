"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { I18nProvider, useI18n } from "@/components/I18nProvider";
import { LanguageToggle } from "@/components/LanguageToggle";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setMsg(data.message || "OK");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="reset-page">
      <div className="reset-page__lang">
        <LanguageToggle />
      </div>
      <h1>{t("reset_title")}</h1>
      <p>{t("reset_sub")}</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="reset-input"
      />
      <button
        type="button"
        className="btn btn--solid"
        disabled={busy || !token || password.length < 8}
        onClick={() => void submit()}
      >
        {busy ? t("auth_creating") : t("reset_update")}
      </button>
      {msg && <p>{msg}</p>}
      <p>
        <a href="/">{t("reset_back")}</a>
      </p>
    </main>
  );
}

export default function ResetPage() {
  return (
    <I18nProvider>
      <Suspense fallback={<main className="reset-page">…</main>}>
        <ResetForm />
      </Suspense>
    </I18nProvider>
  );
}
