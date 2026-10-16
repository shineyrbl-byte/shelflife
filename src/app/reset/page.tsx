"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** Sets a new password from a one-time reset link (emailed, or from the shop owner). */
function Reset() {
  const token = useSearchParams().get("token") ?? "";
  const [valid, setValid] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/reset?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) return setValid(true);
        setMessage((await res.json().catch(() => ({}))).error ?? "This link isn't valid.");
        setValid(false);
      })
      .catch(() => {
        setMessage("Couldn't check the link. Please try again.");
        setValid(false);
      });
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    if (res.ok) {
      // Logged in with the new password; the dashboard sends staff on to Stock.
      window.location.replace("/dashboard");
      return;
    }
    setMessage((await res.json().catch(() => ({}))).error ?? "Something went wrong. Please try again.");
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-sm px-5 py-16">
      <div className="flex items-center gap-2 font-semibold">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
        <img src="/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
        ShelfLife
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Set a new password</h1>
      {valid === null && <p className="mt-4 text-stone-500">Checking your link…</p>}
      {valid === false && (
        <p className="mt-4 text-stone-600">
          {message} <Link href="/forgot" className="text-emerald-700 underline">Get a new link</Link>
        </p>
      )}
      {valid && (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm text-stone-600">
            New password
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-emerald-500 focus:outline-none"
            />
            <span className="text-xs text-stone-400">At least 8 characters. You&apos;ll be logged out on other devices.</span>
          </label>
          {message && <p className="text-sm text-red-600">{message}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy ? "Saving…" : "Save and log in"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <Reset />
    </Suspense>
  );
}
