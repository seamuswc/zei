"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
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
      setMsg(data.message || "Password updated.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="reset-page">
      <h1>Reset password</h1>
      <p>Enter a new password (8+ characters).</p>
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
        {busy ? "…" : "Update password"}
      </button>
      {msg && <p>{msg}</p>}
      <p>
        <a href="/">Back to ZEI</a>
      </p>
    </main>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={<main className="reset-page">Loading…</main>}>
      <ResetForm />
    </Suspense>
  );
}
